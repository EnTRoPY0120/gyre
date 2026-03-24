import { json, error } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import { k8sFluxResourceSchema } from '$lib/server/kubernetes/schemas';
import type { RequestHandler } from './$types';
import {
	listFluxResources,
	createFluxResource,
	type ReqCache,
	type ListOptions
} from '$lib/server/kubernetes/client.js';
import {
	getAllResourcePlurals,
	getResourceDef,
	getResourceTypeByPlural,
	type FluxResourceType
} from '$lib/server/kubernetes/flux/resources.js';
import { handleApiError } from '$lib/server/kubernetes/errors.js';
import { checkPermission } from '$lib/server/rbac.js';
import { validateK8sNamespace } from '$lib/server/validation';
import { VALID_SORT_BY, VALID_SORT_ORDER } from '$lib/config/sorting';

/** Zod schema for POST create FluxCD resource request body – used for OpenAPI and runtime validation */
const createFluxResourceBodySchema = z.looseObject({
	apiVersion: z.string().min(1),
	kind: z.string().min(1),
	metadata: z.looseObject({
		name: z.string().min(1),
		namespace: z.string().optional()
	}),
	spec: z.record(z.string(), z.unknown())
});

export const _metadata = {
	GET: {
		summary: 'List FluxCD resources',
		description: 'Retrieve a paginated, sortable list of resources of a specific type.',
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

	const reqCache: ReqCache = new Map();

	try {
		const result = await listFluxResources(resolvedType, locals.cluster, reqCache, listOptions);

		// Generate ETag from resourceVersion
		const resourceVersion = result.metadata?.resourceVersion;
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

		return json(result);
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

	let rawBody: unknown;
	try {
		rawBody = await request.json();
	} catch {
		throw error(400, { message: 'Invalid JSON in request body' });
	}

	const parsed = createFluxResourceBodySchema.safeParse(rawBody);
	if (!parsed.success) {
		const message = parsed.error.issues
			.map((issue) => {
				const pathLabel = issue.path.length > 0 ? issue.path.join('.') : 'body';
				return `${pathLabel}: ${issue.message}`;
			})
			.join('; ');
		throw error(400, { message: `Invalid request body: ${message}` });
	}

	const body = parsed.data;
	const namespace = body.metadata.namespace ?? 'default';
	validateK8sNamespace(namespace);
	body.metadata.namespace = namespace;

	// Resolve resource type
	const resolvedType = getResourceTypeByPlural(resourceType);
	if (!resolvedType) {
		const validPlurals = getAllResourcePlurals();
		throw error(400, {
			message: `Invalid resource type: ${resourceType}. Valid types: ${validPlurals.join(', ')}`
		});
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

	if (body.kind !== resolvedType) {
		throw error(400, {
			message: `kind mismatch: body declares "${body.kind}" but endpoint handles "${resolvedType}"`
		});
	}

	const resourceDef = getResourceDef(resolvedType)!;
	if (body.apiVersion !== resourceDef.apiVersion) {
		throw error(400, {
			message: `apiVersion mismatch: body declares "${body.apiVersion}" but "${resolvedType}" requires "${resourceDef.apiVersion}"`
		});
	}

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
