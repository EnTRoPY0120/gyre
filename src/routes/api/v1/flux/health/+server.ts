import { json, error } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { getKubeConfig, getPoolMetrics } from '$lib/server/kubernetes/client.js';
import { validateKubeConfig } from '$lib/server/kubernetes/config.js';
import { handleApiError } from '$lib/server/kubernetes/errors.js';

export const _metadata = {
	GET: {
		summary: 'Health check',
		description:
			'Check Kubernetes cluster connectivity. Returns basic status when unauthenticated, or detailed cluster info when authenticated. Results are cached for 30 seconds.',
		tags: ['Flux'],
		security: [],
		responses: {
			200: {
				description: 'Cluster is healthy',
				content: {
					'application/json': {
						schema: z.union([
							z.object({ status: z.literal('healthy') }),
							z.object({
								status: z.literal('healthy'),
								kubernetes: z.object({
									connected: z.boolean(),
									configStrategy: z.enum(['in-cluster', 'local-kubeconfig']),
									configSource: z.enum(['ServiceAccount', 'kubeconfig']),
									currentContext: z.string(),
									availableContexts: z.array(z.string()),
									connectionPool: z.object({
										hits: z.number(),
										misses: z.number(),
										evictions: z.number(),
										poolSizes: z.object({
											customObjects: z.number(),
											coreV1: z.number(),
											appsV1: z.number()
										})
									})
								})
							})
						])
					}
				}
			},
			503: {
				description: 'Unable to connect to Kubernetes cluster',
				content: { 'application/json': { schema: z.object({ message: z.string() }) } }
			}
		}
	}
};
const MAX_CONNECTION_CACHE_SIZE = 20;

// Cache for connection status per cluster
const connectionCache = new Map<string, { connected: boolean; timestamp: number }>();
const CONNECTION_CACHE_TTL = 30 * 1000; // 30 seconds

function pruneConnectionCache() {
	const now = Date.now();
	for (const [key, value] of connectionCache.entries()) {
		if (now - value.timestamp > CONNECTION_CACHE_TTL * 10) {
			connectionCache.delete(key);
		}
	}
	if (connectionCache.size > MAX_CONNECTION_CACHE_SIZE) {
		const sorted = [...connectionCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
		sorted
			.slice(0, connectionCache.size - MAX_CONNECTION_CACHE_SIZE)
			.forEach(([k]) => connectionCache.delete(k));
	}
}

/**
 * GET /api/flux/health
 * Health check endpoint that validates K8s connection
 */
export const GET: RequestHandler = async ({ setHeaders, locals }) => {
	try {
		// Get the current cluster from locals (for multi-cluster support)
		const selectedCluster = locals.cluster;
		const config = await getKubeConfig(selectedCluster);
		const currentContext = config.getCurrentContext();

		const cacheKey = selectedCluster || 'default';
		const cached = connectionCache.get(cacheKey) || { connected: false, timestamp: 0 };

		// Check connection - use cache if recent, otherwise validate
		let isValid = false;
		if (Date.now() - cached.timestamp < CONNECTION_CACHE_TTL) {
			isValid = cached.connected;
		} else {
			isValid = await validateKubeConfig(config);
			pruneConnectionCache();
			connectionCache.set(cacheKey, { connected: isValid, timestamp: Date.now() });
		}

		if (!isValid) {
			throw error(503, {
				message: 'Unable to connect to Kubernetes cluster'
			});
		}

		// If not authenticated, return only basic status to prevent information leakage.
		// Detailed cluster information is restricted to authenticated users.
		if (!locals.user) {
			return json({ status: 'healthy' });
		}

		// Detect mode
		const isInCluster = !!process.env.KUBERNETES_SERVICE_HOST;

		const responseData = {
			status: 'healthy',
			kubernetes: {
				connected: true,
				configStrategy: isInCluster ? 'in-cluster' : 'local-kubeconfig',
				configSource: isInCluster ? 'ServiceAccount' : 'kubeconfig',
				currentContext,
				availableContexts: config.getContexts().map((c) => c.name),
				connectionPool: getPoolMetrics()
			}
		};

		setHeaders({
			'Cache-Control': 'private, max-age=30'
		});

		return json(responseData);
	} catch (err) {
		handleApiError(err, 'Kubernetes health check failed');
	}
};
