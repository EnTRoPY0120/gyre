import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rollbackResource } from '$lib/server/kubernetes/flux/history';
import { getResourceTypeByPlural } from '$lib/server/kubernetes/flux/resources';
import { checkPermission } from '$lib/server/rbac';
import { handleApiError, sanitizeK8sErrorMessage } from '$lib/server/kubernetes/errors.js';
import { logResourceWrite, logAudit } from '$lib/server/audit.js';

export const POST: RequestHandler = async ({ params, locals, request, getClientAddress }) => {
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	const { resourceType, namespace, name } = params;
	let revision: string | undefined;
	let historyId: string | undefined;

	try {
		const body = await request.json();
		revision = body.revision;
		historyId = body.historyId;
	} catch {
		throw error(400, { message: 'Invalid JSON payload' });
	}

	// Either revision or historyId must be provided
	if (!revision && !historyId) {
		throw error(400, { message: 'Either revision or historyId is required for rollback' });
	}

	const resolvedType = getResourceTypeByPlural(resourceType);

	if (!resolvedType) {
		throw error(400, { message: `Invalid resource type: ${resourceType}` });
	}

	// Check permission (admin/write access needed for rollback)
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

	// Use historyId if provided, otherwise use revision
	const target = historyId || revision || '';

	try {
		await rollbackResource(resolvedType, namespace, name, target, locals.cluster);

		// Log the audit event
		await logResourceWrite(locals.user, resolvedType, 'rollback', name, namespace, locals.cluster, {
			ipAddress: getClientAddress(),
			targetRevision: revision,
			targetHistoryId: historyId
		});

		return json({
			success: true,
			message: `Successfully initiated rollback to ${revision || historyId}`
		});
	} catch (err: unknown) {
		// Log failed audit event with flattened details and success: false
		await logAudit(locals.user, 'write:rollback', {
			resourceType: resolvedType,
			resourceName: name,
			namespace,
			clusterId: locals.cluster,
			ipAddress: getClientAddress(),
			success: false,
			details: {
				targetRevision: revision,
				targetHistoryId: historyId,
				error: sanitizeK8sErrorMessage(err instanceof Error ? err.message : String(err))
			}
		});

		handleApiError(err, `Failed to perform rollback for ${name}`);
	}
};
