import { json, error } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { updateFluxResource, type ReqCache } from '$lib/server/kubernetes/client.js';
import { getResourceDef, type FluxResourceType } from '$lib/server/kubernetes/flux/resources.js';
import { handleApiError } from '$lib/server/kubernetes/errors.js';
import { deleteResource } from '$lib/server/kubernetes/flux/actions.js';
import type { K8sResource } from '$lib/types/kubernetes';
import yaml from 'js-yaml';
import {
	validateK8sNamespace,
	validateK8sName,
	validateFluxResourceSpec
} from '$lib/server/validation';
import {
	logPrivilegedMutationFailure,
	logPrivilegedMutationSuccess,
	requireAuthenticatedUser,
	requireClusterContext,
	requireScopedPermission,
	resolveFluxRouteResourceType
} from '$lib/server/http/guards.js';
import {
	computeWeakEtag,
	respondNotModified,
	setPrivateCacheHeaders
} from '$lib/server/http/transport.js';
import { getFluxResourceDetail } from '$lib/server/flux/services.js';

export const _metadata = {
	GET: {
		summary: 'Get FluxCD resource',
		description:
			'Retrieve a specific FluxCD resource by type, namespace, and name. Supports ETag caching via If-None-Match header. Use ?status=true to fetch only the status subresource.',
		tags: ['Flux'],
		request: {
			params: z.object({
				resourceType: z.string().openapi({ example: 'gitrepositories' }),
				namespace: z.string().openapi({ example: 'flux-system' }),
				name: z.string().openapi({ example: 'my-repo' })
			}),
			query: z.object({
				status: z
					.string()
					.optional()
					.openapi({ description: 'Set to "true" to return only the status subresource' })
			})
		},
		responses: {
			200: {
				description: 'The requested resource',
				content: { 'application/json': { schema: z.any() } }
			},
			304: { description: 'Not modified (ETag matched)' },
			400: { description: 'Invalid resource type or missing cluster context' },
			401: { description: 'Authentication required' },
			403: { description: 'Permission denied' },
			404: { description: 'Resource not found' }
		}
	},
	PUT: {
		summary: 'Update FluxCD resource',
		description:
			'Replace a FluxCD resource with the provided YAML. Validates that the name and namespace in the YAML match the URL parameters.',
		tags: ['Flux'],
		request: {
			params: z.object({
				resourceType: z.string().openapi({ example: 'gitrepositories' }),
				namespace: z.string().openapi({ example: 'flux-system' }),
				name: z.string().openapi({ example: 'my-repo' })
			}),
			body: {
				content: {
					'application/json': {
						schema: z.object({
							yaml: z.string().openapi({
								description: 'Complete Kubernetes resource manifest in YAML format',
								example:
									'apiVersion: source.toolkit.fluxcd.io/v1\nkind: GitRepository\nmetadata:\n  name: my-repo\n  namespace: flux-system\nspec:\n  url: https://github.com/org/repo'
							})
						})
					}
				}
			}
		},
		responses: {
			200: {
				description: 'Updated resource',
				content: { 'application/json': { schema: z.any() } }
			},
			400: {
				description: 'Invalid YAML, resource structure, or name/namespace mismatch',
				content: { 'application/json': { schema: z.object({ message: z.string() }) } }
			},
			401: { description: 'Authentication required' },
			403: { description: 'Permission denied' }
		}
	},
	DELETE: {
		summary: 'Delete FluxCD resource',
		description: 'Delete a specific FluxCD resource by type, namespace, and name.',
		tags: ['Flux'],
		request: {
			params: z.object({
				resourceType: z.string().openapi({ example: 'gitrepositories' }),
				namespace: z.string().openapi({ example: 'flux-system' }),
				name: z.string().openapi({ example: 'my-repo' })
			})
		},
		responses: {
			204: { description: 'Resource deleted successfully' },
			400: { description: 'Invalid resource type or missing cluster context' },
			401: { description: 'Authentication required' },
			403: { description: 'Permission denied' },
			404: { description: 'Resource not found' }
		}
	}
};

/**
 * GET /api/flux/{resourceType}/{namespace}/{name}
 * Get a specific resource
 *
 * Query params:
 * - status=true: Get resource status instead of full object
 */
export const GET: RequestHandler = async ({ params, url, locals, request, setHeaders }) => {
	requireAuthenticatedUser(locals);
	requireClusterContext(locals);

	const { resourceType, namespace, name } = params;
	const getStatus = url.searchParams.get('status') === 'true';

	validateK8sNamespace(namespace);
	validateK8sName(name);

	const resolvedType: FluxResourceType = resolveFluxRouteResourceType(resourceType);

	await requireScopedPermission(locals, 'read', resolvedType, namespace);

	const { resource } = await getFluxResourceDetail({
		locals,
		name,
		namespace,
		resourceType,
		statusOnly: getStatus
	});

	const etag = computeWeakEtag(resource.metadata?.resourceVersion);
	const notModified = respondNotModified(request, etag);
	if (notModified) {
		return notModified;
	}

	if (etag) {
		setHeaders({ ETag: etag });
		setPrivateCacheHeaders(setHeaders, 'private, max-age=10, stale-while-revalidate=30');
	}

	return json(resource);
};

/**
 * PUT /api/flux/{resourceType}/{namespace}/{name}
 * Update a specific resource
 *
 * Body: { yaml: string } - The updated resource YAML
 */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	requireAuthenticatedUser(locals);
	requireClusterContext(locals);

	const { resourceType, namespace, name } = params;

	validateK8sNamespace(namespace);
	validateK8sName(name);

	const resolvedType: FluxResourceType = resolveFluxRouteResourceType(resourceType);

	await requireScopedPermission(locals, 'write', resolvedType, namespace);

	// Parse request body
	let body: { yaml?: unknown };
	try {
		body = await request.json();
	} catch {
		throw error(400, { message: 'Invalid JSON in request body' });
	}

	if (!body.yaml || typeof body.yaml !== 'string') {
		throw error(400, { message: 'Missing or invalid yaml field in request body' });
	}

	// Parse YAML to object
	let resource: K8sResource;
	try {
		resource = yaml.load(body.yaml, { schema: yaml.JSON_SCHEMA }) as K8sResource;
	} catch (err) {
		throw error(400, {
			message: `Invalid YAML: ${err instanceof Error ? err.message : 'Unable to parse'}`
		});
	}

	// Validate resource structure
	if (!resource || typeof resource !== 'object') {
		throw error(400, { message: 'Invalid resource: must be a valid Kubernetes object' });
	}

	if (!resource.apiVersion || !resource.kind || !resource.metadata) {
		throw error(400, {
			message: 'Invalid resource: missing required fields (apiVersion, kind, metadata)'
		});
	}

	if (resource.kind !== resolvedType) {
		throw error(400, {
			message: `kind mismatch: expected "${resolvedType}", got "${resource.kind}"`
		});
	}

	const resourceDef = getResourceDef(resolvedType)!;
	if (resource.apiVersion !== resourceDef.apiVersion) {
		throw error(400, {
			message: `apiVersion mismatch: expected "${resourceDef.apiVersion}", got "${resource.apiVersion}"`
		});
	}

	const specError = validateFluxResourceSpec(
		resolvedType,
		(resource.spec ?? {}) as Record<string, unknown>
	);
	if (specError) {
		throw error(422, { message: specError });
	}

	// Validate name and namespace match
	if (resource.metadata.name !== name) {
		throw error(400, {
			message: `Resource name mismatch: expected "${name}", got "${resource.metadata.name}"`
		});
	}

	if (resource.metadata.namespace && resource.metadata.namespace !== namespace) {
		throw error(400, {
			message: `Namespace mismatch: expected "${namespace}", got "${resource.metadata.namespace}"`
		});
	}

	const reqCache: ReqCache = new Map();

	try {
		// Update the resource
		const updated = await updateFluxResource(
			resolvedType,
			namespace,
			name,
			resource,
			locals.cluster,
			reqCache
		);

		return json(updated);
	} catch (err) {
		throw handleApiError(err, `Error updating ${resolvedType} ${namespace}/${name}`);
	}
};

/**
 * DELETE /api/flux/{resourceType}/{namespace}/{name}
 * Delete a specific resource
 */
export const DELETE: RequestHandler = async ({ params, locals, getClientAddress }) => {
	const user = requireAuthenticatedUser(locals);
	const clusterId = requireClusterContext(locals);

	const { resourceType, namespace, name } = params;

	validateK8sNamespace(namespace);
	validateK8sName(name);

	const resolvedType: FluxResourceType = resolveFluxRouteResourceType(resourceType);

	try {
		await requireScopedPermission(locals, 'admin', resolvedType, namespace);
	} catch (err) {
		await logPrivilegedMutationFailure({
			action: 'admin:delete',
			user,
			resourceType: resolvedType,
			name,
			namespace,
			clusterId,
			ipAddress: getClientAddress(),
			error: 'Permission denied'
		});

		throw err;
	}

	try {
		await deleteResource(resolvedType, namespace, name, clusterId);

		await logPrivilegedMutationSuccess({
			action: 'admin:delete',
			user,
			resourceType: resolvedType,
			name,
			namespace,
			clusterId,
			ipAddress: getClientAddress()
		});

		return new Response(null, { status: 204 });
	} catch (err) {
		await logPrivilegedMutationFailure({
			action: 'admin:delete',
			user,
			resourceType: resolvedType,
			name,
			namespace,
			clusterId,
			ipAddress: getClientAddress(),
			error: err
		});

		throw handleApiError(err, `Error deleting ${resolvedType} ${namespace}/${name}`);
	}
};
