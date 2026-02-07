import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rollbackResource } from '$lib/server/kubernetes/flux/history';
import { getResourceTypeByPlural } from '$lib/server/kubernetes/flux/resources';
import { checkPermission } from '$lib/server/rbac';
import { handleApiError, sanitizeK8sErrorMessage } from '$lib/server/kubernetes/errors.js';
import { logResourceWrite } from '$lib/server/audit.js';

export const POST: RequestHandler = async ({ params, locals, request, getClientAddress }) => {
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	const { resourceType, namespace, name } = params;
	let revision: string;

	try {
		const body = await request.json();
		revision = body.revision;
	} catch {
		throw error(400, { message: 'Invalid JSON payload' });
	}

	if (!revision) {
		throw error(400, { message: 'Revision is required for rollback' });
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

	try {
		await rollbackResource(resolvedType, namespace, name, revision);

		// Log the audit event
		await logResourceWrite(locals.user, resolvedType, 'rollback', name, namespace, locals.cluster, {
			ipAddress: getClientAddress(),
			details: { revision }
		});

		return json({ message: `Successfully requested rollback to ${revision}` });
	} catch (err: unknown) {
		// Log failed audit event with sanitized error
		await logResourceWrite(locals.user, resolvedType, 'rollback', name, namespace, locals.cluster, {
			ipAddress: getClientAddress(),
			error: sanitizeK8sErrorMessage(err instanceof Error ? err.message : String(err)),
			details: { revision }
		});

		handleApiError(err, `Failed to perform rollback for ${name}`);
	}
};
