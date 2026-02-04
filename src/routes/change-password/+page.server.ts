import type { PageServerLoad } from './$types';
import { redirect, error } from '@sveltejs/kit';

/**
 * Load function for change password page
 * Requires authentication - handled by hooks.server.ts
 * Prevents SSO users from accessing this page
 * Checks if it's first login via query param
 */
export const load: PageServerLoad = async ({ url, locals }) => {
	// Authentication is handled by hooks.server.ts
	// If we reach here, user is authenticated
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	// Prevent SSO users from accessing password change
	// SSO users authenticate via their identity provider
	if (locals.user.isLocal === false) {
		throw error(403, {
			message: 'SSO users cannot change their password. Please contact your identity provider.'
		});
	}

	// Check if this is first login (from query param)
	const isFirstLogin = url.searchParams.get('first') === 'true';

	return {
		isFirstLogin,
		user: locals.user
	};
};
