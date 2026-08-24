import { json, error } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import { k8sFluxResourceSchema } from '$lib/server/kubernetes/schemas';
import type { RequestHandler } from './$types';
import {
	createFluxResource,
	type ReqCache,
	type ListOptions
} from '$lib/server/kubernetes/client.js';
import { handleApiError } from '$lib/server/kubernetes/errors.js';
import {
	requireAuthenticatedUser,
	requireClusterWideRead,
	requireScopedPermission
} from '$lib/server/http/guards.js';
import { VALID_SORT_BY, VALID_SORT_ORDER } from '$lib/config/sorting';
import {
	computeWeakEtag,
	respondNotModified,
	setPrivateCacheHeaders
} from '$lib/server/http/transport.js';
import { listFluxResourcesForType } from '$lib/server/flux/services.js';
import {
	createFluxResourceBodySchema,
	validateCreateFluxResourceRequest
} from './create-route-helpers';

export const _metadata = {
	GET: {
		summary: 'List FluxCD resources',
		description:
			'Retrieve a paginated, sortable list of resources of a specific type. Requires explicit cluster-wide read permission.',
		tags: ['Flux'],
		request: {
			params: z.object({
				resourceType: z.string().openapi({ example: 'gitrepositories' })
			}),
			query: z.object({
				limit: z.coerce
					.number()
					.int()
					.min(1)
					.max(500)
					.optional()
					.openapi({ description: 'Maximum number of items to return', example: 50 }),
				offset: z.coerce
					.number()
					.int()
					.min(0)
					.optional()
					.openapi({ description: 'Number of items to skip', example: 0 }),
				sortBy: z.enum(VALID_SORT_BY).optional().openapi({ description: 'Field to sort by' }),
				sortOrder: z
					.enum(VALID_SORT_ORDER)
					.optional()
					.openapi({ description: 'Sort direction', example: 'asc' })
			})
		},
		responses: {
			200: {
				description: 'Paginated list of resources',
				content: {
					'application/json': {
						schema: z.object({
							items: z.array(k8sFluxResourceSchema),
							total: z.number().nullable().openapi({
								description: 'Total number of resources, or null when cursor-based paging is used'
							}),
							hasMore: z.boolean().openapi({ description: 'Whether more items exist' }),
							offset: z.number().openapi({ description: 'Current offset' }),
							limit: z.number().openapi({ description: 'Current limit' })
						})
					}
				}
			},
			304: { description: 'Not Modified' },
			400: { description: 'Invalid resource type or query parameter' },
			401: { description: 'Unauthorized' },
			403: { description: 'Permission denied' },
			500: { description: 'Internal server error' }
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
						schema: createFluxResourceBodySchema
					}
				}
			}
		},
		responses: {
			201: {
				description: 'Resource created successfully',
				content: {
					'application/json': {
						schema: k8sFluxResourceSchema
					}
				}
			},
			400: { description: 'Invalid request' },
			401: { description: 'Unauthorized' },
			403: { description: 'Permission denied' },
			500: { description: 'Internal server error' }
		}
	}
};

const listQuerySchema = _metadata.GET.request.query;

/**
 * GET /api/flux/{resourceType}
 * List resources of a specific type across all namespaces.
 * Supports limit, offset, sortBy, and sortOrder query parameters.
 * Accepts both plural names (e.g., 'gitrepositories') and PascalCase (e.g., 'GitRepository')
 */

export const GET: RequestHandler = async ({ params, locals, setHeaders, request, url }) => {
	requireAuthenticatedUser(locals);

	const { resourceType } = params;

	// Parse and validate query parameters
	const queryResult = listQuerySchema.safeParse({
		limit: url.searchParams.get('limit') ?? undefined,
		offset: url.searchParams.get('offset') ?? undefined,
		sortBy: url.searchParams.get('sortBy') ?? undefined,
		sortOrder: url.searchParams.get('sortOrder') ?? undefined
	});

	if (!queryResult.success) {
		const message = queryResult.error.issues
			.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
			.join('; ');
		throw error(400, { message: `Invalid query parameters: ${message}` });
	}

	const listOptions: ListOptions = queryResult.data;
	await requireClusterWideRead(locals);

	const { result } = await listFluxResourcesForType({
		locals,
		query: listOptions,
		resourceType
	});

	const etag = computeWeakEtag(result.metadata?.resourceVersion);
	const notModified = respondNotModified(request, etag);
	if (notModified) {
		return notModified;
	}

	if (etag) {
		setHeaders({ ETag: etag });
	}

	setPrivateCacheHeaders(setHeaders, 'private, max-age=15, stale-while-revalidate=45');
	return json(result);
};

/**
 * POST /api/flux/{resourceType}
 * Create a new resource
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	requireAuthenticatedUser(locals);

	const { resourceType } = params;

	let rawBody: unknown;
	try {
		rawBody = await request.json();
	} catch {
		throw error(400, { message: 'Invalid JSON in request body' });
	}

	const { body, namespace, resolvedType } = validateCreateFluxResourceRequest(
		rawBody,
		resourceType
	);

	await requireScopedPermission(locals, 'write', resolvedType, namespace);

	const reqCache: ReqCache = new Map();

	try {
		const result = await createFluxResource(
			resolvedType,
			namespace,
			body,
			locals.cluster,
			reqCache
		);

		return json(result, { status: 201 });
	} catch (err) {
		handleApiError(err, `Error creating ${resolvedType} resource`);
	}
};
