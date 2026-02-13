import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { isAdmin } from '$lib/server/rbac';

/**
 * Layout load function for admin routes
 * Enforces admin role for all sub-routes
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	// Check if user is authenticated
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	// Check if user is admin
	if (!isAdmin(locals.user)) {
		throw redirect(302, '/?error=not-admin');
	}

	return {
		user: locals.user
	};
};
