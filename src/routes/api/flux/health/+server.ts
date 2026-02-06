import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getKubeConfig } from '$lib/server/kubernetes/client.js';
import { validateKubeConfig } from '$lib/server/kubernetes/config.js';

// Cache for connection status
const connectionCache = { connected: false, timestamp: 0 };
const CONNECTION_CACHE_TTL = 30 * 1000; // 30 seconds

/**
 * GET /api/flux/health
 * Health check endpoint that validates K8s connection
 */
export const GET: RequestHandler = async ({ setHeaders, cookies }) => {
	try {
		// Get the current cluster from cookie (for multi-cluster support)
		const selectedCluster = cookies.get('gyre_cluster');
		const config = await getKubeConfig(selectedCluster);
		const currentContext = config.getCurrentContext();

		// Check connection - use cache if recent, otherwise validate
		let isValid = false;
		let connectionSource = 'fresh';
		if (Date.now() - connectionCache.timestamp < CONNECTION_CACHE_TTL) {
			isValid = connectionCache.connected;
			connectionSource = 'cached';
		} else {
			isValid = await validateKubeConfig(config);
			connectionCache.connected = isValid;
			connectionCache.timestamp = Date.now();
		}

		if (!isValid) {
			return error(503, {
				message: 'Unable to connect to Kubernetes cluster'
			});
		}

		// Detect mode
		const isInCluster = !!process.env.KUBERNETES_SERVICE_HOST;
		const allContexts = config.getContexts().map((c) => c.name);

		const responseData = {
			status: 'healthy',
			kubernetes: {
				connected: true,
				configStrategy: isInCluster ? 'in-cluster' : 'local-kubeconfig',
				configSource: isInCluster ? 'ServiceAccount' : 'kubeconfig',
				currentContext,
				availableContexts: isInCluster ? [currentContext] : allContexts,
				_debug: { connectionSource }
			}
		};

		setHeaders({
			'Cache-Control': 'private, max-age=30',
			'X-Cache': connectionSource === 'cached' ? 'HIT' : 'MISS'
		});

		return json(responseData);
	} catch (err) {
		return error(503, {
			message: err instanceof Error ? err.message : 'Kubernetes configuration error'
		});
	}
};
