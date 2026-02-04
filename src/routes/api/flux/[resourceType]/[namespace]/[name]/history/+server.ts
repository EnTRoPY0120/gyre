import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getResourceHistory } from '$lib/server/kubernetes/flux/history';
import { getResourceTypeByPlural } from '$lib/server/kubernetes/flux/resources';
import { checkPermission } from '$lib/server/rbac';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return error(401, { message: 'Authentication required' });
	}

	const { resourceType, namespace, name } = params;
	const resolvedType = getResourceTypeByPlural(resourceType);

	if (!resolvedType) {
		return error(400, { message: `Invalid resource type: ${resourceType}` });
	}

	// Check permission
	const hasPermission = await checkPermission(
		locals.user,
		'read',
		resolvedType,
		namespace,
		locals.cluster
	);

	if (!hasPermission) {
		return error(403, { message: 'Permission denied' });
	}

	try {
		const history = await getResourceHistory(resolvedType, namespace, name, locals.cluster);
		return json({ history });
	} catch (err: unknown) {
		return error(500, { message: err instanceof Error ? err.message : 'Failed to fetch history' });
	}
};
