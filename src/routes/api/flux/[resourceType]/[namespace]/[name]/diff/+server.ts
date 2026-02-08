import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getFluxResource, getKubeConfig } from '$lib/server/kubernetes/client';
import {
	getResourceTypeByPlural,
	type FluxResourceType
} from '$lib/server/kubernetes/flux/resources';
import { requirePermission } from '$lib/server/rbac';
import * as k8s from '@kubernetes/client-node';
import yaml from 'js-yaml';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';

const execAsync = promisify(exec);

export const GET: RequestHandler = async ({ params, locals }) => {
	const { resourceType: pluralType, namespace, name } = params;
	const clusterId = locals.cluster;

	const resourceType = getResourceTypeByPlural(pluralType);

	// Only kustomizations support diffing for now
	if (resourceType !== 'Kustomization') {
		throw error(400, 'Diffing is only supported for Kustomizations');
	}

	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	await requirePermission(locals.user, 'read', 'Kustomization', namespace, clusterId);

	try {
		// 1. Get the Kustomization resource
		const kustomization = await getFluxResource(
			resourceType as FluxResourceType,
			namespace,
			name,
			clusterId
		);

		if (!kustomization.spec?.sourceRef) {
			throw error(400, 'Kustomization has no sourceRef');
		}

		const spec = kustomization.spec;

		// 2. Get the Source resource
		const sourceRef = spec.sourceRef as { kind: string; name: string; namespace?: string };
		const sourceNamespace = sourceRef.namespace || namespace;

		const source = await getFluxResource(
			sourceRef.kind as FluxResourceType,
			sourceNamespace,
			sourceRef.name,
			clusterId
		);

		const artifactUrl = (source.status as { artifact?: { url: string } } | undefined)?.artifact
			?.url;

		// 3. Fetch the source content (Artifact or Git Clone)
		const tempDir = await mkdtemp(join(tmpdir(), 'gyre-diff-'));

		try {
			let sourceFetched = false;

			// Strategy A: Try to fetch the artifact from source-controller
			if (artifactUrl) {
				try {
					const artifactPath = join(tempDir, 'artifact.tar.gz');
					let buffer: ArrayBuffer;

					// Handle cluster-internal URLs
					if (artifactUrl.includes('.svc.cluster.local')) {
						console.log(`ℹ Proxying internal artifact URL: ${artifactUrl}`);
						const config = await getKubeConfig(clusterId);
						const url = new URL(artifactUrl);
						const hostParts = url.hostname.split('.');
						const svcName = hostParts[0];
						const svcNamespace = hostParts[1];
						const port = url.port || '80';

						const coreApi = config.makeApiClient(k8s.CoreV1Api);
						const proxyPath = `${url.pathname}${url.search}`;

						// Use the client's proxy capability
						const proxyResponse = await coreApi.connectGetNamespacedServiceProxy({
							name: `${svcName}:${port}`,
							namespace: svcNamespace,
							path: proxyPath
						});

						// proxyResponse IS the body when using connectGetNamespacedServiceProxy
						// Note: If this still fails with "not in gzip format", Strategy B will catch it
						buffer = Buffer.from(proxyResponse as string).buffer;
					} else {
						// Normal external URL
						const response = await fetch(artifactUrl);
						if (!response.ok) throw new Error(`Artifact fetch failed: ${response.statusText}`);
						buffer = await response.arrayBuffer();
					}

					await writeFile(artifactPath, Buffer.from(buffer));
					await execAsync(`tar -xzf ${artifactPath} -C ${tempDir}`);
					sourceFetched = true;
					console.log('✓ Source fetched via artifact');
				} catch (err) {
					console.warn(
						`⚠️ Artifact fetch failed, falling back to Git clone: ${(err as Error).message}`
					);
				}
			}

			// Strategy B: Fallback to Git Clone (The "GitHub" approach suggested by user)
			if (!sourceFetched) {
				const repoUrl = source.spec?.url as string;
				if (!repoUrl) {
					throw new Error('No artifact available and no repository URL found');
				}

				console.log(`ℹ Attempting Git clone from: ${repoUrl}`);

				// Clean temp dir before cloning to avoid "already exists" error

				await rm(tempDir, { recursive: true, force: true });

				const { mkdir } = await import('node:fs/promises');

				await mkdir(tempDir, { recursive: true });

				// Convert SSH to HTTPS for easier public cloning if needed

				let cloneUrl = repoUrl;

				// Handle standard SSH: git@github.com:user/repo

				if (repoUrl.startsWith('git@')) {
					cloneUrl = repoUrl.replace(':', '/').replace('git@', 'https://');
				}

				// Handle ssh:// protocol: ssh://git@github.com/user/repo
				else if (repoUrl.startsWith('ssh://')) {
					cloneUrl = repoUrl.replace('ssh://git@', 'https://');
				}

				const ref = (source.spec?.ref as { branch?: string; tag?: string }) || {};

				const branch = ref.branch || 'main';

				await execAsync(`git clone --depth 1 --branch ${branch} ${cloneUrl} ${tempDir}`);

				sourceFetched = true;
				console.log('✓ Source fetched via Git clone');
			}

			// 4. Run kustomize build
			const kustomizePath = join(tempDir, (spec.path as string) || './');
			const { stdout: buildOutput } = await execAsync(`kustomize build ${kustomizePath}`);

			// 5. Split multi-resource YAML into individual resources
			const desiredResources = yaml.loadAll(buildOutput) as Array<Record<string, unknown>>;

			// 5. Compare each resource with live state
			const diffs = await Promise.all(
				desiredResources.map(async (desired) => {
					if (!desired || !desired.kind || !desired.metadata) return null;

					const kind = desired.kind as string;
					const metadata = desired.metadata as { name: string; namespace?: string };
					const resName = metadata.name;
					const resNamespace = metadata.namespace || (spec.targetNamespace as string) || namespace;
					const apiVersion = desired.apiVersion as string;

					// Fetch live state
					let liveState: unknown = null;
					try {
						const config = await getKubeConfig(clusterId);
						// This is a bit simplified, we'd need a more robust way to get any resource
						// For now, let's use a generic approach if possible
						const group = apiVersion.includes('/') ? apiVersion.split('/')[0] : '';
						const version = apiVersion.includes('/') ? apiVersion.split('/')[1] : apiVersion;

						// We need the plural for the custom objects API
						let plural = kind.toLowerCase() + 's';
						if (kind.toLowerCase().endsWith('y')) {
							plural = kind.toLowerCase().slice(0, -1) + 'ies';
						} else if (kind.toLowerCase().endsWith('s')) {
							plural = kind.toLowerCase() + 'es';
						}

						if (kind === 'Ingress') plural = 'ingresses';

						const api = config.makeApiClient(k8s.CustomObjectsApi);
						const liveResponse = await api.getNamespacedCustomObject({
							group,
							version,
							namespace: resNamespace,
							plural,
							name: resName
						});
						liveState = liveResponse;
					} catch {
						// Resource might not exist yet
						liveState = null;
					}

					// To get a meaningful diff, we should use dry-run=server if possible
					// For now, we'll return the desired and live state and let the frontend diff them
					return {
						kind,
						name: resName,
						namespace: resNamespace,
						desired: yaml.dump(desired),
						live: liveState ? yaml.dump(liveState) : null
					};
				})
			);

			return json({
				diffs: diffs.filter((d) => d !== null)
			});
		} finally {
			// Cleanup temp dir
			await rm(tempDir, { recursive: true, force: true });
		}
	} catch (err) {
		console.error('Diff error:', err);
		throw error(500, (err as Error).message || 'Failed to calculate diff');
	}
};
