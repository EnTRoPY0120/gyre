import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getControllerLogs } from '$lib/server/kubernetes/client';
import type { FluxResourceType } from '$lib/server/kubernetes/flux/resources';
import { checkPermission } from '$lib/server/rbac.js';
import { handleApiError } from '$lib/server/kubernetes/errors.js';

export const GET: RequestHandler = async ({ params, locals }) => {
	// Check authentication
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	const { type, namespace, name } = params;

	// Check permission for read action
	const hasPermission = await checkPermission(
		locals.user,
		'read',
		type as FluxResourceType,
		namespace,
		locals.cluster
	);

	if (!hasPermission) {
		throw error(403, { message: 'Permission denied' });
	}

	try {
		const logs = await getControllerLogs(type as FluxResourceType, namespace, name, locals.cluster);
		return json({ logs });
	} catch (err) {
		handleApiError(err, `Error fetching logs for ${name}`);
	}
};
