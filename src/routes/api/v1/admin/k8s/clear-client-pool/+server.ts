import { json, error } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { clearClientPool } from '$lib/server/kubernetes/client.js';

export const _metadata = {
	POST: {
		summary: 'Clear Kubernetes client connection pool',
		description:
			'Evicts all cached Kubernetes API client instances, forcing fresh connections on the next request. Useful after kubeconfig rotation. Admin access required.',
		tags: ['Admin'],
		responses: {
			200: {
				description: 'Pool cleared successfully',
				content: {
					'application/json': {
						schema: z.object({ message: z.string() })
					}
				}
			},
			401: { description: 'Unauthenticated' },
			403: { description: 'Forbidden' }
		}
	}
};

export const POST: RequestHandler = async ({ locals }) => {
	// Hook enforces admin role for /api/v1/admin/* routes; guard here as defence-in-depth
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	if (locals.user.role !== 'admin') {
		throw error(403, { message: 'Admin access required' });
	}

	clearClientPool();
	return json({ message: 'Connection pool cleared' });
};
