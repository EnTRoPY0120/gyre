import { json, error } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { getResourceEvents } from '$lib/server/kubernetes/events';

export const _metadata = {
	GET: {
		summary: 'Get resource events',
		description: 'Retrieve Kubernetes events associated with a specific FluxCD resource.',
		tags: ['Flux'],
		request: {
			params: z.object({
				resourceType: z.string().openapi({ example: 'gitrepositories' }),
				namespace: z.string().openapi({ example: 'flux-system' }),
				name: z.string().openapi({ example: 'my-repo' })
			})
		},
		responses: {
			200: {
				description: 'Events for the resource',
				content: {
					'application/json': {
						schema: z.object({ events: z.array(z.any()) })
					}
				}
			},
			400: { description: 'Invalid resource type' },
			401: { description: 'Authentication required' },
			403: { description: 'Permission denied' }
		}
	}
};
import { getResourceTypeByPlural, FLUX_RESOURCES } from '$lib/server/kubernetes/flux/resources';
import type { FluxResourceType } from '$lib/server/kubernetes/flux/resources';
import { checkPermission } from '$lib/server/rbac.js';
import { handleApiError } from '$lib/server/kubernetes/errors.js';

export const GET: RequestHandler = async ({ params, locals }) => {
	// Check authentication
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	const { resourceType, namespace, name } = params;

	// Resolve the resource type from plural name
	const resolvedType: FluxResourceType | undefined = getResourceTypeByPlural(resourceType);

	if (!resolvedType) {
		throw error(400, `Invalid resource type: ${resourceType}`);
	}

	// Check permission for read action
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

	// Get the resource kind from FLUX_RESOURCES
	const resourceDef = FLUX_RESOURCES[resolvedType];
	const resourceKind = resourceDef.kind;

	try {
		const events = await getResourceEvents(namespace, name, resourceKind, locals.cluster);
		return json({ events });
	} catch (err) {
		handleApiError(err, `Failed to fetch events for ${resourceType}/${namespace}/${name}`);
	}
};
