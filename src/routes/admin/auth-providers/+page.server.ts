/**
 * Auth Providers Admin Page - Server Load
 * Loads all auth providers for admin management
 */

import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals }) => {
	// Check authentication
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	// Check admin role
	if (locals.user.role !== 'admin') {
		throw redirect(302, '/');
	}

	try {
		const db = await getDb();
		const providers = await db.query.authProviders.findMany({
			orderBy: (authProviders, { asc }) => [asc(authProviders.name)]
		});

		// Sanitize client secrets
		const sanitizedProviders = providers.map((p) => ({
			...p,
			clientSecretEncrypted: '***'
		}));

		return {
			providers: sanitizedProviders
		};
	} catch (error) {
		console.error('Failed to load auth providers:', error);
		return {
			providers: []
		};
	}
};
