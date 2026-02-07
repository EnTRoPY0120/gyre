import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rollbackResource } from '$lib/server/kubernetes/flux/history';
import { getResourceTypeByPlural } from '$lib/server/kubernetes/flux/resources';
import { checkPermission } from '$lib/server/rbac';
import { handleApiError } from '$lib/server/kubernetes/errors.js';

export const POST: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	const { resourceType, namespace, name } = params;
	const { revision } = await request.json();

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
		return json({ message: `Successfully requested rollback to ${revision}` });
	} catch (err: unknown) {
		handleApiError(err, `Failed to perform rollback for ${name}`);
	}
};
