import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

/**
 * Load function for change password page
 * Requires authentication - handled by hooks.server.ts
 * Checks if it's first login via query param
 */
export const load: PageServerLoad = async ({ url, locals }) => {
	// Authentication is handled by hooks.server.ts
	// If we reach here, user is authenticated
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	// Check if this is first login (from query param)
	const isFirstLogin = url.searchParams.get('first') === 'true';

	return {
		isFirstLogin,
		user: locals.user
	};
};
