import { error, json } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { deleteResource } from '$lib/server/kubernetes/flux/actions';
import { MAX_BATCH_SIZE } from '$lib/server/config/limits';
import { batchResourceSchema, batchResultSchema } from '$lib/server/kubernetes/flux/batch-schemas';
import type {
	BatchResourceItem,
	BatchOperationResult
} from '$lib/server/kubernetes/flux/batch-schemas';

export const _metadata = {
	POST: {
		summary: 'Batch delete resources',
		description: `Delete multiple FluxCD resources (up to ${MAX_BATCH_SIZE}) in a single request. This is a destructive operation. Per-resource permission checks are applied.`,
		tags: ['Flux'],
		request: {
			body: {
				content: {
					'application/json': {
						schema: z.object({
							resources: z
								.array(batchResourceSchema)
								.max(MAX_BATCH_SIZE)
								.openapi({ description: `List of resources to delete (max ${MAX_BATCH_SIZE})` })
						})
					}
				}
			}
		},
		responses: {
			200: {
				description: 'Batch operation results',
				content: {
					'application/json': {
						schema: z.object({
							results: z.array(batchResultSchema),
							summary: z.object({
								total: z.number(),
								successful: z.number(),
								failed: z.number()
							})
						})
					}
				}
			},
			400: { description: 'Invalid request body or missing cluster context' },
			401: { description: 'Authentication required' }
		}
	}
};
import type { FluxResourceType } from '$lib/server/kubernetes/flux/resources';
import { getAllResourceTypes } from '$lib/server/kubernetes/flux/resources';
import { checkPermission } from '$lib/server/rbac.js';
import { logAudit } from '$lib/server/audit.js';
import { sanitizeK8sErrorMessage } from '$lib/server/kubernetes/errors.js';

export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
	// Check authentication
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	// Validate cluster context
	if (!locals.cluster || typeof locals.cluster !== 'string') {
		throw error(400, { message: 'Cluster context required' });
	}

	// Parse request body
	let body: { resources?: BatchResourceItem[] };
	try {
		body = await request.json();
	} catch {
		throw error(400, { message: 'Invalid JSON in request body' });
	}

	if (!body.resources || !Array.isArray(body.resources)) {
		throw error(400, { message: 'Missing or invalid resources array in request body' });
	}

	// Check batch size limit
	if (body.resources.length > MAX_BATCH_SIZE) {
		throw error(400, {
			message: `Batch size exceeded: maximum ${MAX_BATCH_SIZE} resources allowed per request`
		});
	}

	const results: BatchOperationResult[] = [];
	const validResourceTypes = getAllResourceTypes();

	// Process each resource
	for (const resource of body.resources) {
		// Validate resource has required fields
		if (
			!resource ||
			typeof resource.type !== 'string' ||
			typeof resource.namespace !== 'string' ||
			typeof resource.name !== 'string' ||
			!resource.type ||
			!resource.namespace ||
			!resource.name
		) {
			const errorMessage = 'Invalid resource: missing required fields (type, namespace, name)';
			results.push({
				resource: resource || { type: 'unknown', namespace: 'unknown', name: 'unknown' },
				success: false,
				message: errorMessage
			});

			await logAudit(locals.user, 'write:delete', {
				resourceType: resource?.type || 'unknown',
				resourceName: resource?.name || 'unknown',
				namespace: resource?.namespace || 'unknown',
				clusterId: locals.cluster,
				ipAddress: getClientAddress(),
				success: false,
				details: { error: errorMessage }
			});

			continue;
		}

		// Validate resource type is valid FluxResourceType
		if (!validResourceTypes.includes(resource.type as FluxResourceType)) {
			const errorMessage = `Invalid resource type: ${resource.type}`;
			results.push({
				resource,
				success: false,
				message: errorMessage
			});

			await logAudit(locals.user, 'write:delete', {
				resourceType: resource.type,
				resourceName: resource.name,
				namespace: resource.namespace,
				clusterId: locals.cluster,
				ipAddress: getClientAddress(),
				success: false,
				details: { error: errorMessage }
			});

			continue;
		}
		try {
			// Check permission for each resource
			const hasPermission = await checkPermission(
				locals.user,
				'write',
				resource.type as FluxResourceType,
				resource.namespace,
				locals.cluster
			);

			if (!hasPermission) {
				results.push({
					resource,
					success: false,
					message: 'Permission denied'
				});

				// Log failed audit event
				await logAudit(locals.user, 'write:delete', {
					resourceType: resource.type,
					resourceName: resource.name,
					namespace: resource.namespace,
					clusterId: locals.cluster,
					ipAddress: getClientAddress(),
					success: false,
					details: { error: 'Permission denied' }
				});

				continue;
			}

			// Delete the resource
			await deleteResource(
				resource.type as FluxResourceType,
				resource.namespace,
				resource.name,
				locals.cluster
			);

			results.push({
				resource,
				success: true,
				message: `Deleted ${resource.name}`
			});

			// Log successful audit event
			await logAudit(locals.user, 'write:delete', {
				resourceType: resource.type,
				resourceName: resource.name,
				namespace: resource.namespace,
				clusterId: locals.cluster,
				ipAddress: getClientAddress(),
				success: true
			});
		} catch (err) {
			const errorMessage = sanitizeK8sErrorMessage(
				err instanceof Error ? err.message : String(err)
			);

			results.push({
				resource,
				success: false,
				message: errorMessage
			});

			// Log failed audit event
			await logAudit(locals.user, 'write:delete', {
				resourceType: resource.type,
				resourceName: resource.name,
				namespace: resource.namespace,
				clusterId: locals.cluster,
				ipAddress: getClientAddress(),
				success: false,
				details: { error: errorMessage }
			});
		}
	}

	const successCount = results.filter((r) => r.success).length;
	const totalCount = results.length;

	return json({
		results,
		summary: {
			total: totalCount,
			successful: successCount,
			failed: totalCount - successCount
		}
	});
};
