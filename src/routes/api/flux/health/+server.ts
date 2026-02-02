import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getKubeConfig } from '$lib/server/kubernetes/client.js';
import { validateKubeConfig } from '$lib/server/kubernetes/config.js';

/**
 * GET /api/flux/health
 * Health check endpoint that validates K8s connection
 */
export const GET: RequestHandler = async ({ locals }) => {
	try {
		const { config, strategy, source, contexts } = getKubeConfig(locals.cluster);
		const isValid = await validateKubeConfig(config);

		if (!isValid) {
			return error(503, {
				message: 'Unable to connect to Kubernetes cluster'
			});
		}

		return json({
			status: 'healthy',
			kubernetes: {
				connected: true,
				configStrategy: strategy,
				configSource: source,
				availableContexts: contexts,
				currentContext: config.getCurrentContext()
			}
		});
	} catch (err) {
		return error(503, {
			message: err instanceof Error ? err.message : 'Kubernetes configuration error'
		});
	}
};
