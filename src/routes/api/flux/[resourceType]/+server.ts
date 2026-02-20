import { json, error } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { listFluxResources, createFluxResource } from '$lib/server/kubernetes/client.js';
import {
	getAllResourcePlurals,
	getResourceTypeByPlural,
	type FluxResourceType
} from '$lib/server/kubernetes/flux/resources.js';
import { handleApiError } from '$lib/server/kubernetes/errors.js';
import { checkPermission } from '$lib/server/rbac.js';

export const _metadata = {
	GET: {
		summary: 'List FluxCD resources',
		description: 'Retrieve a list of all resources of a specific type across all namespaces.',
		tags: ['Flux'],
		request: {
			params: z.object({
				resourceType: z.string().openapi({ example: 'gitrepositories' })
			})
		},
		responses: {
			200: {
				description: 'List of resources',
				content: {
					'application/json': {
						schema: z.object({
							items: z.array(z.any())
						})
					}
				}
			},
			400: { description: 'Invalid resource type' },
			401: { description: 'Unauthorized' },
			403: { description: 'Permission denied' }
		}
	},
	POST: {
		summary: 'Create FluxCD resource',
		description: 'Create a new FluxCD resource of a specific type.',
		tags: ['Flux'],
		request: {
			params: z.object({
				resourceType: z.string().openapi({ example: 'gitrepositories' })
			}),
			body: {
				content: {
					'application/json': {
						schema: z.object({
							apiVersion: z.string(),
							kind: z.string(),
							metadata: z.object({
								name: z.string(),
								namespace: z.string().optional()
							}),
							spec: z.record(z.string(), z.any())
						})
					}
				}
			}
		},
		responses: {
			200: {
				description: 'Resource created successfully',
				content: {
					'application/json': {
						schema: z.any()
					}
				}
			},
			400: { description: 'Invalid request' },
			401: { description: 'Unauthorized' },
			403: { description: 'Permission denied' }
		}
	}
};

/**
 * GET /api/flux/{resourceType}
 * List all resources of a specific type across all namespaces
 * Accepts both plural names (e.g., 'gitrepositories') and PascalCase (e.g., 'GitRepository')
 */

export const GET: RequestHandler = async ({ params, locals, setHeaders, request }) => {
	// Check authentication
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	const { resourceType } = params;

	// Try to resolve resource type from plural name first (e.g., 'gitrepositories' -> 'GitRepository')
	const resolvedType: FluxResourceType | undefined = getResourceTypeByPlural(resourceType);

	// If not found by plural, check if it's already a valid PascalCase type
	if (!resolvedType) {
		const validPlurals = getAllResourcePlurals();
		throw error(400, {
			message: `Invalid resource type: ${resourceType}. Valid types: ${validPlurals.join(', ')}`
		});
	}

	// Check permission (all namespaces)
	const hasPermission = await checkPermission(
		locals.user,
		'read',
		resolvedType,
		undefined,
		locals.cluster
	);

	if (!hasPermission) {
		throw error(403, { message: 'Permission denied' });
	}

	try {
		const resources = await listFluxResources(resolvedType, locals.cluster);

		// Generate ETag from resourceVersion
		const resourceVersion = resources.metadata?.resourceVersion;
		const etag = resourceVersion ? `W/"${resourceVersion}"` : null;

		if (etag) {
			const ifNoneMatch = request.headers.get('if-none-match');
			if (ifNoneMatch === etag) {
				return new Response(null, { status: 304 });
			}
			setHeaders({ ETag: etag });
		}

		setHeaders({
			'Cache-Control': 'private, max-age=15, stale-while-revalidate=45'
		});

		return json(resources);
	} catch (err) {
		handleApiError(err, `Error listing ${resolvedType} resources`);
	}
};

/**
 * POST /api/flux/{resourceType}
 * Create a new resource
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	// Check authentication
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	const { resourceType } = params;
	const body = await request.json();
	const namespace = body.metadata?.namespace || 'default';

	// Resolve resource type
	const resolvedType = getResourceTypeByPlural(resourceType);
	if (!resolvedType) {
		throw error(400, { message: `Invalid resource type: ${resourceType}` });
	}

	// Check permission
	const hasPermission = await checkPermission(
		locals.user,
		'write',
		resolvedType,
		namespace,
		locals.cluster
	);

	if (!hasPermission) {
		throw error(403, { message: 'Permission denied' });
	}

	try {
		const result = await createFluxResource(resolvedType, namespace, body, locals.cluster);

		return json(result);
	} catch (err) {
		handleApiError(err, `Error creating ${resolvedType} resource`);
	}
};
