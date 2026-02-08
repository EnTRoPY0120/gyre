import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getFluxResource, getKubeConfig } from '$lib/server/kubernetes/client';
import type { FluxResourceType } from '$lib/server/kubernetes/flux/resources';
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
	const { resourceType, namespace, name } = params;
	const clusterId = locals.cluster;

	// Only kustomizations support diffing for now
	if (resourceType !== 'kustomizations') {
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
		const sourcePlural = sourceRef.kind.toLowerCase() + 's';

		const source = await getFluxResource(
			sourcePlural as FluxResourceType,
			sourceNamespace,
			sourceRef.name,
			clusterId
		);

		const artifactUrl = source.status?.artifact?.url;
		if (!artifactUrl) {
			throw error(400, 'Source has no artifact URL. Ensure it is reconciled.');
		}

		// 3. Fetch the artifact and run kustomize build
		// Note: In a real cluster, artifactUrl might be internal (http://source-controller.flux-system.svc.cluster.local/...)
		// We need to ensure Gyre can reach it.

		// Create a temporary directory
		const tempDir = await mkdtemp(join(tmpdir(), 'gyre-diff-'));

		try {
			// Download and extract artifact
			const artifactPath = join(tempDir, 'artifact.tar.gz');
			const response = await fetch(artifactUrl);
			if (!response.ok) {
				throw new Error(`Failed to fetch artifact from ${artifactUrl}: ${response.statusText}`);
			}

			const buffer = await response.arrayBuffer();
			await writeFile(artifactPath, Buffer.from(buffer));

			// Extract
			await execAsync(`tar -xzf ${artifactPath} -C ${tempDir}`);

			// Run kustomize build
			const kustomizePath = join(tempDir, (spec.path as string) || './');
			const { stdout: buildOutput } = await execAsync(`kustomize build ${kustomizePath}`);

			// 4. Split multi-resource YAML into individual resources
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
						// Heuristic: lowercase kind + 's' (doesn't work for all, e.g. Ingress -> ingresses)
						// But many work.
						// TODO: Use a better mapping
						let plural = kind.toLowerCase() + 's';
						if (plural.endsWith('ys')) plural = plural.slice(0, -2) + 'ies';
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
