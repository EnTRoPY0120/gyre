import { json, error } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { listFluxResourcesInNamespace } from '$lib/server/kubernetes/client.js';

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
import {
	getAllResourcePlurals,
	getResourceTypeByPlural,
	type FluxResourceType
} from '$lib/server/kubernetes/flux/resources.js';
import { handleApiError } from '$lib/server/kubernetes/errors.js';
import { checkPermission } from '$lib/server/rbac.js';

/**
 * GET /api/flux/{resourceType}/{namespace}
 * List all resources of a specific type in a namespace
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	// Check authentication
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	const { resourceType, namespace } = params;

	// Resolve resource type from plural name
	const resolvedType: FluxResourceType | undefined = getResourceTypeByPlural(resourceType);
	if (!resolvedType) {
		const validPlurals = getAllResourcePlurals();
		throw error(400, {
			message: `Invalid resource type: ${resourceType}. Valid types: ${validPlurals.join(', ')}`
		});
	}

	// Check permission for specific namespace
	const hasPermission = await checkPermission(
		locals.user,
		'read',
		resolvedType,
		namespace,
		locals.cluster
	);

	if (!hasPermission) {
		throw error(403, { message: 'Permission denied' });
	}

	try {
		const resources = await listFluxResourcesInNamespace(resolvedType, namespace, locals.cluster);
		return json(resources);
	} catch (err) {
		handleApiError(err, `Error listing ${resolvedType} in namespace ${namespace}`);
	}
};
