import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { toggleSuspendResource } from '$lib/server/kubernetes/flux/actions';
import type { FluxResourceType } from '$lib/server/kubernetes/flux/resources';
import { checkPermission } from '$lib/server/rbac.js';
import { logAudit } from '$lib/server/audit.js';
import { sanitizeK8sErrorMessage } from '$lib/server/kubernetes/errors.js';

interface BatchResourceItem {
	type: string;
	namespace: string;
	name: string;
}

interface BatchOperationResult {
	resource: BatchResourceItem;
	success: boolean;
	message: string;
}

export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
	// Check authentication
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
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

	const results: BatchOperationResult[] = [];

	// Process each resource
	for (const resource of body.resources) {
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
				await logAudit(locals.user, 'write:suspend', {
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

			// Suspend the resource
			await toggleSuspendResource(
				resource.type as FluxResourceType,
				resource.namespace,
				resource.name,
				true,
				locals.cluster
			);

			results.push({
				resource,
				success: true,
				message: `Suspended ${resource.name}`
			});

			// Log successful audit event
			await logAudit(locals.user, 'write:suspend', {
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
			await logAudit(locals.user, 'write:suspend', {
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
