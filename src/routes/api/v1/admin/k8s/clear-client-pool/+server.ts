import { json, error } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { clearClientPool } from '$lib/server/kubernetes/client.js';
import { checkPermission } from '$lib/server/rbac.js';
import { logAudit } from '$lib/server/audit';

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
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	// Enforce RBAC with no cluster context — this is a global system operation,
	// not scoped to any specific cluster. The admin role short-circuits immediately;
	// RBAC policy evaluation proceeds without a cluster filter.
	const hasPermission = await checkPermission(
		locals.user,
		'admin',
		undefined,
		undefined,
		undefined
	);
	if (!hasPermission) {
		throw error(403, { message: 'Forbidden: admin permission required' });
	}

	clearClientPool();
	await logAudit(locals.user, 'k8s-client-pool:clear', {
		resourceType: 'KubernetesClientPool',
		resourceName: 'global',
		clusterId: locals.cluster ?? null,
		details: {}
	});
	return json({ message: 'Connection pool cleared' });
};
