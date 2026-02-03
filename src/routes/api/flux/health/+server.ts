import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getKubeConfig } from '$lib/server/kubernetes/client.js';
import { validateKubeConfig } from '$lib/server/kubernetes/config.js';

// Separate caches for contexts (rarely change) and connection status (changes more frequently)
const contextsCache = new Map<
	string,
	{ contexts: string[]; currentContext: string; timestamp: number }
>();
const connectionCache = new Map<string, { connected: boolean; timestamp: number }>();
const CONTEXTS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes - contexts rarely change
const CONNECTION_CACHE_TTL = 30 * 1000; // 30 seconds - connection status changes

/**
 * GET /api/flux/health
 * Health check endpoint that validates K8s connection
 */
export const GET: RequestHandler = async ({ locals, setHeaders }) => {
	const clusterKey = locals.cluster || 'default';
	const contextsCacheKey = `contexts-${clusterKey}`;
	const connectionCacheKey = `connection-${clusterKey}`;

	const cachedContexts = contextsCache.get(contextsCacheKey);
	const cachedConnection = connectionCache.get(connectionCacheKey);

	try {
		const { config, strategy, source, contexts } = getKubeConfig(locals.cluster);
		const currentContext = config.getCurrentContext();

		// Use cached contexts if available
		let availableContexts = contexts;
		let contextSource = 'fresh';
		if (cachedContexts && Date.now() - cachedContexts.timestamp < CONTEXTS_CACHE_TTL) {
			availableContexts = cachedContexts.contexts;
			contextSource = 'cached';
		} else {
			// Cache the contexts for next time
			contextsCache.set(contextsCacheKey, {
				contexts,
				currentContext,
				timestamp: Date.now()
			});
		}

		// Check connection - use cache if recent, otherwise validate
		let isValid = false;
		let connectionSource = 'fresh';
		if (cachedConnection && Date.now() - cachedConnection.timestamp < CONNECTION_CACHE_TTL) {
			isValid = cachedConnection.connected;
			connectionSource = 'cached';
		} else {
			isValid = await validateKubeConfig(config);
			connectionCache.set(connectionCacheKey, {
				connected: isValid,
				timestamp: Date.now()
			});
		}

		if (!isValid) {
			return error(503, {
				message: 'Unable to connect to Kubernetes cluster'
			});
		}

		const responseData = {
			status: 'healthy',
			kubernetes: {
				connected: true,
				configStrategy: strategy,
				configSource: source,
				availableContexts,
				currentContext,
				_debug: { contextSource, connectionSource } // Debug info (remove in production)
			}
		};

		setHeaders({
			'Cache-Control': 'private, max-age=30',
			'X-Cache': contextSource === 'cached' && connectionSource === 'cached' ? 'HIT' : 'MISS'
		});

		return json(responseData);
	} catch (err) {
		return error(503, {
			message: err instanceof Error ? err.message : 'Kubernetes configuration error'
		});
	}
};
