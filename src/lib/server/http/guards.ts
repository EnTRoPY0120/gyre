import { error } from '@sveltejs/kit';
import {
	checkClusterWideReadPermission,
	checkPermission,
	requirePermission,
	RbacError,
	type RbacAction
} from '$lib/server/rbac.js';

export function requireAuthenticatedUser(locals: App.Locals) {
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	return locals.user;
}

export function requireClusterContext(locals: App.Locals) {
	if (!locals.cluster) {
		throw error(400, { message: 'Cluster context required' });
	}

	return locals.cluster;
}

export async function requireClusterWideRead(locals: App.Locals): Promise<void> {
	const user = requireAuthenticatedUser(locals);
	const hasPermission = await checkClusterWideReadPermission(user, locals.cluster);

	if (!hasPermission) {
		throw error(403, { message: 'Permission denied' });
	}
}

export async function requireScopedPermission(
	locals: App.Locals,
	action: RbacAction,
	resourceType: string,
	namespace?: string
): Promise<void> {
	const user = requireAuthenticatedUser(locals);
	const hasPermission = await checkPermission(
		user,
		action,
		resourceType,
		namespace,
		locals.cluster
	);

	if (!hasPermission) {
		throw error(403, { message: 'Permission denied' });
	}
}

export async function requireAdminPermission(
	locals: App.Locals,
	resourceType?: string,
	namespace?: string
): Promise<void> {
	const user = requireAuthenticatedUser(locals);

	try {
		await requirePermission(user, 'admin', resourceType, namespace, locals.cluster);
	} catch (err) {
		if (err instanceof RbacError) {
			throw error(403, { message: 'Permission denied' });
		}

		throw err;
	}
}
