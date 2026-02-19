import { json, error } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { getResourceEvents } from '$lib/server/kubernetes/events';
import { getResourceTypeByPlural, FLUX_RESOURCES } from '$lib/server/kubernetes/flux/resources';
import type { FluxResourceType } from '$lib/server/kubernetes/flux/resources';
import { checkPermission } from '$lib/server/rbac.js';
import { handleApiError } from '$lib/server/kubernetes/errors.js';

const eventSchema = z.object({
	type: z.string().openapi({ example: 'Normal' }),
	reason: z.string().openapi({ example: 'ReconciliationSucceeded' }),
	message: z.string().openapi({ example: 'Applied revision: main@sha1:abc1234' }),
	firstTimestamp: z.string().nullable().optional().openapi({ example: '2024-01-15T10:00:00Z' }),
	lastTimestamp: z.string().nullable().optional().openapi({ example: '2024-01-15T10:30:00Z' }),
	count: z.number().openapi({ example: 3 }),
	involvedObject: z.object({
		apiVersion: z.string().optional(),
		kind: z.string().optional().openapi({ example: 'Kustomization' }),
		name: z.string().optional().openapi({ example: 'my-app' }),
		namespace: z.string().optional(),
		uid: z.string().optional()
	}),
	source: z.object({ component: z.string().optional() }),
	metadata: z
		.object({
			name: z.string().optional().openapi({ example: 'my-app.17a2b3c4d5e6f' }),
			namespace: z.string().optional(),
			uid: z.string().optional()
		})
		.optional()
});

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
						schema: z.object({ events: z.array(eventSchema) })
					}
				}
			},
			400: { description: 'Invalid resource type' },
			401: { description: 'Authentication required' },
			403: { description: 'Permission denied' },
			500: { description: 'Internal server error' }
		}
	}
};

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
