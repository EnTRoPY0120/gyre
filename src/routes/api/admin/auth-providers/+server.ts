/**
 * Auth Providers Management API
 * CRUD operations for SSO provider configuration.
 * Admin-only endpoints.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { authProviders, type NewAuthProvider } from '$lib/server/db/schema';
import { encryptSecret } from '$lib/server/auth/crypto';
import { validateProviderConfig } from '$lib/server/auth/oauth';
import { randomBytes } from 'node:crypto';
import { checkPermission } from '$lib/server/rbac.js';

/**
 * Generate a unique provider ID
 */
function generateProviderId(): string {
	return randomBytes(16).toString('hex');
}

/**
 * GET /api/admin/auth-providers
 * List all auth providers (admin only)
 */
export const GET: RequestHandler = async ({ locals }) => {
	// Check authentication
	if (!locals.user) {
		throw error(401, { message: 'Unauthorized' });
	}

	// Check permission (admin action needed for auth providers)
	const hasPermission = await checkPermission(locals.user, 'admin', 'AuthProvider');
	if (!hasPermission) {
		throw error(403, { message: 'Admin access required' });
	}

	try {
		const db = await getDb();
		const providers = await db.query.authProviders.findMany({
			orderBy: (authProviders, { asc }) => [asc(authProviders.name)]
		});

		// Remove sensitive data before sending to client
		const sanitizedProviders = providers.map((p) => ({
			...p,
			clientSecretEncrypted: '***' // Don't send encrypted secret to client
		}));

		return json({ providers: sanitizedProviders });
	} catch (err) {
		console.error('Failed to list auth providers:', err);
		throw error(500, { message: 'Failed to load providers' });
	}
};

/**
 * POST /api/admin/auth-providers
 * Create a new auth provider (admin only)
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	// Check authentication
	if (!locals.user) {
		throw error(401, { message: 'Unauthorized' });
	}

	// Check permission (admin action needed for auth providers)
	const hasPermission = await checkPermission(locals.user, 'admin', 'AuthProvider');
	if (!hasPermission) {
		throw error(403, { message: 'Admin access required' });
	}

	try {
		const body = await request.json();

		// Extract and validate provider data
		const {
			name,
			type,
			enabled = true,
			clientId,
			clientSecret, // Plain text secret (will be encrypted)
			issuerUrl,
			authorizationUrl,
			tokenUrl,
			userInfoUrl,
			jwksUrl,
			autoProvision = true,
			defaultRole = 'viewer',
			roleMapping,
			roleClaim = 'groups',
			usernameClaim = 'preferred_username',
			emailClaim = 'email',
			usePkce = true,
			scopes = 'openid profile email'
		} = body;

		// Validate required fields
		if (!name || !type || !clientId || !clientSecret) {
			throw error(400, { message: 'Missing required fields' });
		}

		// Encrypt client secret
		const clientSecretEncrypted = encryptSecret(clientSecret);

		// Create new provider
		const newProvider: NewAuthProvider = {
			id: generateProviderId(),
			name,
			type,
			enabled,
			clientId,
			clientSecretEncrypted,
			issuerUrl: issuerUrl || null,
			authorizationUrl: authorizationUrl || null,
			tokenUrl: tokenUrl || null,
			userInfoUrl: userInfoUrl || null,
			jwksUrl: jwksUrl || null,
			autoProvision,
			defaultRole,
			roleMapping: roleMapping || null,
			roleClaim,
			usernameClaim,
			emailClaim,
			usePkce,
			scopes
		};

		// Validate provider configuration
		const validation = validateProviderConfig(newProvider);
		if (!validation.valid) {
			throw error(400, { message: validation.errors.join(', ') });
		}

		// Insert into database
		const db = await getDb();
		await db.insert(authProviders).values(newProvider);

		console.log(`Created new auth provider: ${name} (${type})`);

		return json({
			success: true,
			provider: {
				...newProvider,
				clientSecretEncrypted: '***' // Don't send back to client
			}
		});
	} catch (err) {
		console.error('Failed to create auth provider:', err);

		// Re-throw SvelteKit errors
		if (err instanceof Response) {
			throw err;
		}

		throw error(500, { message: 'Failed to create provider' });
	}
};
