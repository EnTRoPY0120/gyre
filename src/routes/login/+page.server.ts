import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

/**
 * Load function for login page
 * If user is already authenticated, redirect to home
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(302, '/');
	}

	return {
		mode: locals.cluster ? 'in-cluster' : 'local'
	};
};
