import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rollbackResource } from '$lib/server/kubernetes/flux/history';
import { getResourceTypeByPlural } from '$lib/server/kubernetes/flux/resources';
import { checkPermission } from '$lib/server/rbac';

export const POST: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) {
		return error(401, { message: 'Authentication required' });
	}

	const { resourceType, namespace, name } = params;
	const { revision } = await request.json();

	if (!revision) {
		return error(400, { message: 'Revision is required for rollback' });
	}

	const resolvedType = getResourceTypeByPlural(resourceType);

	if (!resolvedType) {
		return error(400, { message: `Invalid resource type: ${resourceType}` });
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
		return error(403, { message: 'Permission denied' });
	}

	try {
		await rollbackResource(resolvedType, namespace, name, revision, locals.cluster);
		return json({ message: `Successfully requested rollback to ${revision}` });
	} catch (err: unknown) {
		return error(500, {
			message: err instanceof Error ? err.message : 'Failed to perform rollback'
		});
	}
};
