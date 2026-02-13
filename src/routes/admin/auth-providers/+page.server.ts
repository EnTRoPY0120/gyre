/**
 * Auth Providers Admin Page - Server Load
 * Loads all auth providers for admin management
 */

import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';

export const load: PageServerLoad = async () => {
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
