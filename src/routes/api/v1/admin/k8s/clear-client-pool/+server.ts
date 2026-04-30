import { json } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { clearClientPool } from '$lib/server/kubernetes/client.js';
import {
	logPrivilegedMutationSuccess,
	requirePrivilegedAdminPermission
} from '$lib/server/http/guards.js';

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
	// Enforce RBAC with no cluster context — this is a global system operation,
	// not scoped to any specific cluster. The admin role short-circuits immediately;
	// RBAC policy evaluation proceeds without a cluster filter.
	const user = await requirePrivilegedAdminPermission({ ...locals, cluster: undefined });

	clearClientPool();
	await logPrivilegedMutationSuccess({
		action: 'k8s-client-pool:clear',
		user,
		resourceType: 'KubernetesClientPool',
		name: 'global',
		clusterId: locals.cluster,
		details: {}
	});
	return json({ message: 'Connection pool cleared' });
};
