/**
 * Auth Providers Admin Page - Server Load
 * Loads all auth providers for admin management
 */

import { logger } from '$lib/server/logger.js';
import { parseRoleMappingInput } from '$lib/auth/role-mapping';
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
			clientSecretEncrypted: '***',
			roleMapping: (() => {
				try {
					return parseRoleMappingInput(p.roleMapping);
				} catch {
					logger.warn({ providerId: p.id }, '[auth-providers] Malformed roleMapping JSON');
					return null;
				}
			})()
		}));

		return {
			providers: sanitizedProviders
		};
	} catch (error) {
		logger.error(error, 'Failed to load auth providers:');
		return {
			providers: []
		};
	}
};
