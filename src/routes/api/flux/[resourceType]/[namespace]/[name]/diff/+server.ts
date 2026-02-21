import { json, error } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { getFluxResource, getKubeConfig, type ReqCache } from '$lib/server/kubernetes/client';
import {
	getResourceTypeByPlural,
	type FluxResourceType,
	FLUX_RESOURCES
} from '$lib/server/kubernetes/flux/resources';
import { requirePermission } from '$lib/server/rbac';
import * as k8s from '@kubernetes/client-node';
import yaml from 'js-yaml';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';

export const _metadata = {
	GET: {
		summary: 'Get resource drift diff',
		description:
			'Compare the desired state (from source artifact) against the live cluster state for a Kustomization. Only available when Gyre is deployed in-cluster.',
		tags: ['Flux'],
		request: {
			params: z.object({
				resourceType: z.string().openapi({ example: 'kustomizations' }),
				namespace: z.string().openapi({ example: 'flux-system' }),
				name: z.string().openapi({ example: 'my-app' })
			}),
			query: z.object({
				force: z
					.string()
					.optional()
					.openapi({ description: 'Set to "true" to bypass the cache and recompute the diff' })
			})
		},
		responses: {
			200: {
				description: 'Drift diff results',
				content: {
					'application/json': {
						schema: z.object({
							diffs: z.array(
								z.object({
									kind: z.string(),
									name: z.string(),
									namespace: z.string(),
									desired: z.string(),
									live: z.string().nullable(),
									error: z.string().optional()
								})
							),
							timestamp: z.number(),
							revision: z.string().nullable().optional()
						})
					}
				}
			},
			400: { description: 'Unsupported resource type or missing sourceRef' },
			401: { description: 'Unauthorized' },
			403: { description: 'Permission denied' },
			503: { description: 'Drift detection only available in-cluster' }
		}
	}
};

const execAsync = promisify(exec);

// Helper function to download artifact using Node.js http module
// This is more reliable in-cluster than fetch() for internal service calls
function downloadArtifact(url: string, timeoutMs = 15000): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const parsedUrl = new URL(url);
		const client = parsedUrl.protocol === 'https:' ? https : http;

		const chunks: Buffer[] = [];
		let totalBytes = 0;

		const request = client.get(
			url,
			{
				timeout: timeoutMs,
				headers: {
					Accept: 'application/gzip, application/x-gzip, application/x-tar',
					'User-Agent': 'gyre-drift-detector'
				}
			},
			(response) => {
				if (response.statusCode !== 200) {
					let errorBody = '';
					response.on('data', (chunk) => {
						errorBody += chunk.toString();
					});
					response.on('end', () => {
						reject(
							new Error(
								`HTTP ${response.statusCode}: ${response.statusMessage}. Body: ${errorBody.slice(0, 200)}`
							)
						);
					});
					return;
				}

				response.on('data', (chunk: Buffer) => {
					chunks.push(chunk);
					totalBytes += chunk.length;

					// Safety limit: 100MB
					if (totalBytes > 100 * 1024 * 1024) {
						request.destroy();
						reject(new Error('Artifact too large (>100MB)'));
					}
				});

				response.on('end', () => {
					resolve(Buffer.concat(chunks));
				});

				response.on('error', reject);
			}
		);

		request.on('error', reject);
		request.on('timeout', () => {
			request.destroy();
			reject(new Error(`Request timeout after ${timeoutMs}ms`));
		});
	});
}

export const GET: RequestHandler = async ({ params, locals, url }) => {
	const { resourceType: pluralType, namespace, name } = params;
	const clusterId = locals.cluster;
	const forceRefresh = url.searchParams.get('force') === 'true';

	// Check if running in-cluster (required for drift detection)
	const isInCluster = !!process.env.KUBERNETES_SERVICE_HOST;
	if (!isInCluster) {
		throw error(
			503,
			'Drift detection is only available when Gyre is deployed in a Kubernetes cluster. ' +
				'This feature requires in-cluster access to the source-controller and is not supported in local development mode.'
		);
	}

	const resourceType = getResourceTypeByPlural(pluralType);

	// Only kustomizations support diffing for now
	if (resourceType !== 'Kustomization') {
		throw error(400, 'Diffing is only supported for Kustomizations');
	}

	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	await requirePermission(locals.user, 'read', 'Kustomization', namespace, clusterId);

	const reqCache: ReqCache = new Map();

	try {
		// 1. Get the Kustomization resource
		const kustomization = await getFluxResource(
			resourceType as FluxResourceType,
			namespace,
			name,
			clusterId,
			reqCache
		);

		if (!kustomization.spec?.sourceRef) {
			throw error(400, 'Kustomization has no sourceRef');
		}

		const spec = kustomization.spec;

		const currentRevision = (kustomization.status as { lastAppliedRevision?: string })
			?.lastAppliedRevision;

		// 2. Get the Source resource
		const sourceRef = spec.sourceRef as { kind: string; name: string; namespace?: string };
		const sourceNamespace = sourceRef.namespace || namespace;

		const source = await getFluxResource(
			sourceRef.kind as FluxResourceType,
			sourceNamespace,
			sourceRef.name,
			clusterId,
			reqCache
		);

		const artifactUrl = (source.status as { artifact?: { url: string } } | undefined)?.artifact
			?.url;

		if (!artifactUrl) {
			throw error(
				400,
				`Source ${sourceRef.kind}/${sourceRef.name} has no artifact URL. ` +
					'Ensure the source is ready and has reconciled successfully.'
			);
		}

		// 3. Fetch the source content via artifact
		const tempDir = await mkdtemp(join(tmpdir(), 'gyre-diff-'));

		try {
			console.log(`ℹ Fetching artifact from: ${artifactUrl}`);
			const artifactPath = join(tempDir, 'artifact.tar.gz');
			let buffer: Buffer;

			// Clean up the URL - remove trailing dot after cluster.local
			// FluxCD URLs have format: http://source-controller.flux-system.svc.cluster.local./path
			// But the actual HTTP server listens on: http://source-controller.flux-system.svc.cluster.local/path
			const cleanUrl = artifactUrl.replace(/\.cluster\.local\./g, '.cluster.local');

			console.log(`ℹ Cleaned URL: ${cleanUrl}`);

			// Try downloading the artifact using Node.js http module
			// This is more reliable for in-cluster service-to-service communication than fetch()
			try {
				buffer = await downloadArtifact(cleanUrl);
				console.log(`✓ Artifact download successful (${buffer.length} bytes)`);
			} catch (downloadErr) {
				console.log(`ℹ HTTP download failed: ${(downloadErr as Error).message}`);
				console.log(`ℹ Trying kubectl exec fallback method`);

				// Fallback: Use port-forward via Kubernetes API to access the artifact
				// This works for both in-cluster and local development
				try {
					const config = await getKubeConfig(clusterId, reqCache);
					const coreApi = config.makeApiClient(k8s.CoreV1Api);

					// Get source-controller pod name
					const pods = await coreApi.listNamespacedPod({
						namespace: 'flux-system',
						labelSelector: 'app=source-controller'
					});

					if (!pods.items || pods.items.length === 0) {
						throw new Error('No source-controller pod found in flux-system namespace');
					}

					const podName = pods.items[0].metadata?.name;
					if (!podName) {
						throw new Error('source-controller pod has no name');
					}

					console.log(`ℹ Using source-controller pod: ${podName}`);

					// Use Kubernetes API to proxy HTTP request through the pod
					// This works because we're accessing the pod's HTTP server via K8s API proxy
					const urlPath = new URL(cleanUrl).pathname;

					console.log(`ℹ Fetching via K8s pod proxy: ${urlPath}`);

					try {
						// Use connectGetNamespacedPodProxy to make HTTP request through the pod
						// Port 9090 is the source-controller's HTTP artifact server
						// The port is included in the 'name' parameter as podName:port
						const proxyResponse = await coreApi.connectGetNamespacedPodProxy({
							name: `${podName}:9090`,
							namespace: 'flux-system',
							path: urlPath
						});

						buffer = Buffer.isBuffer(proxyResponse)
							? proxyResponse
							: Buffer.from(proxyResponse as string, 'binary');

						console.log(`✓ K8s pod proxy fetch successful (${buffer.length} bytes)`);
					} catch (proxyErr) {
						console.error(`Pod proxy error:`, proxyErr);
						throw proxyErr;
					}
				} catch (execErr) {
					throw new Error(
						`All fetch methods failed. ` +
							`Direct HTTP: ${(downloadErr as Error).message}. ` +
							`K8s proxy: ${(execErr as Error).message}. ` +
							`\n\nTroubleshooting:\n` +
							`1. Check source-controller is running: kubectl get pod -n flux-system -l app=source-controller\n` +
							`2. Verify artifact exists: kubectl get gitrepo -n ${sourceNamespace} ${sourceRef.name} -o jsonpath='{.status.artifact.url}'\n` +
							`3. Test artifact URL manually: kubectl port-forward -n flux-system svc/source-controller 9090:80 && curl http://localhost:9090${new URL(cleanUrl).pathname}`
					);
				}
			}

			// Validate it's actually a gzip/tarball (check magic bytes)
			if (buffer.length < 2) {
				throw new Error(`Downloaded content too small (${buffer.length} bytes)`);
			}

			// gzip magic bytes: 0x1f 0x8b
			const isGzip = buffer[0] === 0x1f && buffer[1] === 0x8b;

			if (!isGzip) {
				// Try to parse as JSON/HTML to get better error message
				const text = buffer.toString('utf-8', 0, Math.min(500, buffer.length));
				throw new Error(
					`Downloaded content is not a gzip archive (magic bytes: 0x${buffer[0]?.toString(16)} 0x${buffer[1]?.toString(16)}). ` +
						`Content preview: ${text}`
				);
			}

			// Write and extract the tarball
			await writeFile(artifactPath, buffer);

			try {
				await execAsync(`tar -tzf "${artifactPath}" > /dev/null`, {
					timeout: 5000
				});
				console.log('✓ Tarball validation passed');
			} catch (tarCheckErr) {
				throw new Error(
					`Downloaded file is not a valid tar.gz archive: ${(tarCheckErr as Error).message}`
				);
			}

			await execAsync(`tar -xzf "${artifactPath}" -C "${tempDir}"`, {
				timeout: 30000,
				maxBuffer: 50 * 1024 * 1024 // 50MB max
			});

			console.log('✓ Source artifact extracted successfully');

			// 4. Run kustomize build
			// Validate spec.path to prevent command injection
			const specPath = (spec.path as string) || './';

			// Reject absolute paths and path traversal attempts
			if (specPath.startsWith('/') || specPath.includes('..')) {
				throw new Error(`Invalid path: ${specPath}. Path must be relative and cannot contain ".."`);
			}

			// Resolve and normalize the path
			const kustomizePath = join(tempDir, specPath);

			// Ensure the resolved path is still inside tempDir
			if (!kustomizePath.startsWith(tempDir)) {
				throw new Error(`Path traversal detected: ${specPath}`);
			}

			console.log(`ℹ Running kustomize build on: ${kustomizePath}`);

			const { stdout: buildOutput } = await execAsync(`kustomize build "${kustomizePath}"`, {
				timeout: 30000, // 30 second timeout
				maxBuffer: 10 * 1024 * 1024 // 10MB max output
			});

			console.log(`✓ Kustomize build completed (${buildOutput.length} bytes)`);

			// 5. Parse resources and compare using Server-Side Dry-Run
			const desiredResources = yaml.loadAll(buildOutput) as Array<Record<string, unknown>>;
			const config = await getKubeConfig(clusterId, reqCache);
			const customApi = config.makeApiClient(k8s.CustomObjectsApi);

			const diffs = await Promise.all(
				desiredResources.map(async (desired) => {
					if (!desired || !desired.kind || !desired.metadata) return null;

					const kind = desired.kind as string;
					const metadata = desired.metadata as { name: string; namespace?: string };
					const resName = metadata.name;
					const resNamespace = metadata.namespace || (spec.targetNamespace as string) || namespace;
					const apiVersion = desired.apiVersion as string;
					const [group, version] = apiVersion.includes('/')
						? apiVersion.split('/')
						: ['', apiVersion];

					// 1. Try to get plural from our known Flux resources
					let plural = '';

					// Explicitly type the values to avoid inference issues
					const fluxDefs = Object.values(FLUX_RESOURCES) as Array<{ kind: string; plural: string }>;
					const fluxDef = fluxDefs.find((r) => r.kind === kind);

					if (fluxDef) {
						plural = fluxDef.plural;
					} else {
						// 2. Fallback to heuristic pluralization for core/other resources
						plural = kind.toLowerCase() + 's';
						if (kind.toLowerCase().endsWith('y')) plural = kind.toLowerCase().slice(0, -1) + 'ies';
						else if (kind.toLowerCase().endsWith('s')) plural = kind.toLowerCase() + 'es';
						if (kind === 'Ingress') plural = 'ingresses';
						if (kind === 'Endpoints') plural = 'endpoints';
					}

					try {
						// A. Get Live State
						let liveState: unknown = null;
						try {
							liveState = await customApi.getNamespacedCustomObject({
								group,
								version,
								namespace: resNamespace,
								plural,
								name: resName
							});
						} catch {
							// Resource doesn't exist
						}

						// B. Get "Should Be" state via Server-Side Apply Dry-Run
						// This returns the resource as it would look after applying, including defaults
						let dryRunState: unknown = null;
						try {
							// We use patch with fieldManager and dryRun=All
							// The JS client expects dryRun as a string 'All', not an array for some versions
							const response = await customApi.patchNamespacedCustomObject(
								{
									group,
									version,
									namespace: resNamespace,
									plural,
									name: resName,
									body: desired as object,
									dryRun: 'All',
									fieldManager: 'gyre-drift-check',
									force: true
								},
								{
									headers: { 'Content-Type': 'application/apply-patch+yaml' }
								} as Record<string, unknown>
							);
							dryRunState = response;
						} catch {
							// If dry-run fails, fall back to raw desired state
							dryRunState = desired;
						}

						// Strip noisy fields for cleaner diff
						const clean = (obj: unknown): unknown => {
							if (!obj) return null;
							const c = JSON.parse(JSON.stringify(obj));
							if (c.metadata) {
								// Standard K8s metadata to remove
								const toDelete = [
									'managedFields',
									'generation',
									'resourceVersion',
									'uid',
									'creationTimestamp',
									'selfLink'
								];
								toDelete.forEach((f) => {
									delete c.metadata[f];
								});

								// Remove noisy annotations
								if (c.metadata.annotations) {
									const annosToDelete = [
										'kubectl.kubernetes.io/last-applied-configuration',
										'deployment.kubernetes.io/revision',
										'kustomize.toolkit.fluxcd.io/reconcile'
									];
									annosToDelete.forEach((a) => {
										delete c.metadata.annotations[a];
									});
									if (Object.keys(c.metadata.annotations).length === 0) {
										delete c.metadata.annotations;
									}
								}

								// Remove noisy labels
								if (c.metadata.labels) {
									delete c.metadata.labels['kustomize.toolkit.fluxcd.io/name'];
									delete c.metadata.labels['kustomize.toolkit.fluxcd.io/namespace'];
									if (Object.keys(c.metadata.labels).length === 0) {
										delete c.metadata.labels;
									}
								}
							}
							delete c.status;
							return c;
						};

						return {
							kind,
							name: resName,
							namespace: resNamespace,
							desired: yaml.dump(clean(dryRunState)),
							live: liveState ? yaml.dump(clean(liveState)) : null
						};
					} catch (err) {
						console.error(`Error diffing ${kind}/${resName}:`, err);
						return {
							kind,
							name: resName,
							namespace: resNamespace,
							desired: yaml.dump(desired),
							live: null,
							error: (err as Error).message
						};
					}
				})
			);

			const filteredDiffs = diffs.filter((d) => d !== null);

			const cacheControl = forceRefresh ? 'no-cache, private' : 'max-age=60, private';

			return json(
				{
					diffs: filteredDiffs,
					timestamp: Date.now(),
					revision: currentRevision
				},
				{ headers: { 'Cache-Control': cacheControl } }
			);
		} finally {
			await rm(tempDir, { recursive: true, force: true }).catch((cleanupErr) => {
				console.warn(`⚠️  Failed to cleanup temp dir: ${cleanupErr}`);
			});
		}
	} catch (err) {
		console.error('Diff error:', err);
		const message = err instanceof Error ? err.message : 'Failed to calculate diff';

		// Provide more helpful error messages based on common failures
		if (message.includes('not in gzip format')) {
			throw error(
				500,
				'The artifact downloaded from source-controller is not a valid gzip archive. ' +
					'This usually indicates the source-controller service is returning an error page instead of the artifact. ' +
					'Check that the source-controller is running and the GitRepository/Bucket has reconciled successfully.'
			);
		} else if (message.includes('tar:')) {
			throw error(500, `Failed to extract source artifact: ${message}`);
		} else if (message.includes('kustomize')) {
			throw error(500, `Kustomize build failed: ${message}`);
		} else if (message.includes('timeout')) {
			throw error(
				504,
				'Operation timed out. The kustomization may be too large or the source artifact is unavailable.'
			);
		}

		throw error(500, message);
	}
};
