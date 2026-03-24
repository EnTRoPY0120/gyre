import type { PageServerLoad } from './$types';
import { redirect, error } from '@sveltejs/kit';
import { GYRE_VERSION } from '$lib/config/version';

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

	// Prevent in-cluster admin from accessing password change
	// The in-cluster admin password is stored in a Kubernetes secret and the login
	// flow always validates against it — updating only the DB hash would lock the
	// admin out on next login. Password rotation must be done via the K8s secret.
	if (!locals.user.passwordHash) {
		throw error(403, {
			message:
				'The in-cluster admin password is managed via the Kubernetes secret "gyre-initial-admin-secret". Update the secret to rotate the password.'
		});
	}

	// Check if this is first login (from query param)
	const isFirstLogin = url.searchParams.get('first') === 'true';

	return {
		isFirstLogin,
		user: locals.user,
		gyreVersion: GYRE_VERSION
	};
};
