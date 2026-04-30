import { json } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { listFluxResourcesInNamespace, type ReqCache } from '$lib/server/kubernetes/client.js';
import type { FluxResourceType } from '$lib/server/kubernetes/flux/resources.js';
import { handleApiError } from '$lib/server/kubernetes/errors.js';
import {
	requireAuthenticatedUser,
	requireScopedPermission,
	resolveFluxRouteResourceType
} from '$lib/server/http/guards.js';
import { validateK8sNamespace } from '$lib/server/validation';

export const _metadata = {
	GET: {
		summary: 'List FluxCD resources in namespace',
		description: 'Retrieve all FluxCD resources of a specific type within a given namespace.',
		tags: ['Flux'],
		request: {
			params: z.object({
				resourceType: z.string().openapi({ example: 'gitrepositories' }),
				namespace: z.string().openapi({ example: 'flux-system' })
			})
		},
		responses: {
			200: {
				description: 'List of resources in the namespace',
				content: {
					'application/json': {
						schema: z.object({
							items: z.array(z.any()),
							metadata: z.any().optional()
						})
					}
				}
			},
			400: { description: 'Invalid resource type' },
			401: { description: 'Authentication required' },
			403: { description: 'Permission denied' }
		}
	}
};

/**
 * GET /api/flux/{resourceType}/{namespace}
 * List all resources of a specific type in a namespace
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	requireAuthenticatedUser(locals);

	const { resourceType, namespace } = params;

	validateK8sNamespace(namespace);

	const resolvedType: FluxResourceType = resolveFluxRouteResourceType(resourceType);
	await requireScopedPermission(locals, 'read', resolvedType, namespace);

	const reqCache: ReqCache = new Map();

	try {
		const resources = await listFluxResourcesInNamespace(
			resolvedType,
			namespace,
			locals.cluster,
			reqCache
		);
		return json(resources);
	} catch (err) {
		handleApiError(err, `Error listing ${resolvedType} in namespace ${namespace}`);
	}
};
