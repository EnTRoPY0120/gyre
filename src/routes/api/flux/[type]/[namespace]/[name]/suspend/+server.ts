import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { toggleSuspendResource } from '$lib/server/kubernetes/flux/actions';
import type { FluxResourceType } from '$lib/server/kubernetes/flux/resources';
import { checkPermission } from '$lib/server/rbac.js';
import { logResourceWrite } from '$lib/server/audit.js';
import { handleApiError } from '$lib/server/kubernetes/errors.js';

export const POST: RequestHandler = async ({ params, locals, getClientAddress }) => {
	// Check authentication
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	const { type, namespace, name } = params;

	// Check permission for write action
	const hasPermission = await checkPermission(
		locals.user,
		'write',
		type as FluxResourceType,
		namespace,
		locals.cluster
	);

	if (!hasPermission) {
		throw error(403, { message: 'Permission denied' });
	}

	try {
		await toggleSuspendResource(type as FluxResourceType, namespace, name, true, locals.cluster);

		// Log the audit event
		await logResourceWrite(locals.user, type, 'suspend', name, namespace, locals.cluster, {
			ipAddress: getClientAddress()
		});

		return json({ success: true, message: `Suspended ${name}` });
	} catch (err) {
		// Log failed audit event
		await logResourceWrite(locals.user, type, 'suspend', name, namespace, locals.cluster, {
			ipAddress: getClientAddress(),
			error: (err as Error).message
		});

		handleApiError(err, `Error suspending ${name}`);
	}
};
