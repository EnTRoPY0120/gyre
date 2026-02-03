import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { reconcileResource } from '$lib/server/kubernetes/flux/actions';
import type { FluxResourceType } from '$lib/server/kubernetes/flux/resources';
import { checkPermission } from '$lib/server/rbac.js';
import { logResourceWrite } from '$lib/server/audit.js';

export const POST: RequestHandler = async ({ params, locals, getClientAddress }) => {
	// Check authentication
	if (!locals.user) {
		return error(401, { message: 'Authentication required' });
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
		return error(403, { message: 'Permission denied' });
	}

	try {
		await reconcileResource(type as FluxResourceType, namespace, name, locals.cluster);

		// Log the audit event
		await logResourceWrite(locals.user, type, 'reconcile', name, namespace, locals.cluster, {
			ipAddress: getClientAddress()
		});

		return json({ success: true, message: `Reconciliation triggered for ${name}` });
	} catch (err) {
		console.error(`Error reconciling ${name}:`, err);

		// Log failed audit event
		await logResourceWrite(locals.user, type, 'reconcile', name, namespace, locals.cluster, {
			ipAddress: getClientAddress(),
			error: (err as Error).message
		});

		return error(500, `Failed to trigger reconciliation: ${(err as Error).message}`);
	}
};
