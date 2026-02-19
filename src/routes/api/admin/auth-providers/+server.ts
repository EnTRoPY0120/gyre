/**
 * Auth Providers Management API
 * CRUD operations for SSO provider configuration.
 * Admin-only endpoints.
 */

import { json, error } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';

const providerTypeSchema = z.enum([
	'oidc',
	'oauth2-github',
	'oauth2-google',
	'oauth2-gitlab',
	'oauth2-generic'
]);

const authProviderSchema = z.object({
	id: z.string(),
	name: z.string().openapi({ example: 'My OIDC Provider' }),
	type: providerTypeSchema,
	enabled: z.boolean(),
	clientId: z.string().openapi({ example: 'my-client-id' }),
	clientSecretEncrypted: z.string().openapi({ example: '***' }),
	issuerUrl: z.string().nullable().optional().openapi({ example: 'https://accounts.example.com' }),
	authorizationUrl: z.string().nullable().optional(),
	tokenUrl: z.string().nullable().optional(),
	userInfoUrl: z.string().nullable().optional(),
	jwksUrl: z.string().nullable().optional(),
	autoProvision: z.boolean(),
	defaultRole: z.enum(['admin', 'editor', 'viewer']),
	roleMapping: z.record(z.string(), z.string()).nullable().optional(),
	roleClaim: z.string().openapi({ example: 'groups' }),
	usernameClaim: z.string().openapi({ example: 'preferred_username' }),
	emailClaim: z.string().openapi({ example: 'email' }),
	usePkce: z.boolean(),
	scopes: z.string().openapi({ example: 'openid profile email' })
});

export const _metadata = {
	GET: {
		summary: 'List auth providers',
		description: 'Retrieve all configured SSO/OAuth providers. Admin access required.',
		tags: ['Admin'],
		responses: {
			200: {
				description: 'List of auth providers (client secrets are redacted)',
				content: {
					'application/json': {
						schema: z.object({ providers: z.array(authProviderSchema) })
					}
				}
			},
			401: { description: 'Unauthorized' },
			403: { description: 'Admin access required' }
		}
	},
	POST: {
		summary: 'Create auth provider',
		description:
			'Create a new SSO/OAuth provider configuration. The client secret is encrypted at rest. Admin access required.',
		tags: ['Admin'],
		request: {
			body: {
				content: {
					'application/json': {
						schema: z.object({
							name: z.string().openapi({ example: 'My OIDC Provider' }),
							type: providerTypeSchema,
							enabled: z.boolean().optional(),
							clientId: z.string().openapi({ example: 'my-client-id' }),
							clientSecret: z.string().openapi({ example: 'my-client-secret' }),
							issuerUrl: z.string().optional().openapi({ example: 'https://accounts.example.com' }),
							authorizationUrl: z.string().optional(),
							tokenUrl: z.string().optional(),
							userInfoUrl: z.string().optional(),
							jwksUrl: z.string().optional(),
							autoProvision: z.boolean().optional(),
							defaultRole: z.enum(['admin', 'editor', 'viewer']).optional(),
							roleMapping: z.record(z.string(), z.string()).optional(),
							roleClaim: z.string().optional(),
							usernameClaim: z.string().optional(),
							emailClaim: z.string().optional(),
							usePkce: z.boolean().optional(),
							scopes: z.string().optional()
						})
					}
				}
			}
		},
		responses: {
			200: {
				description: 'Provider created successfully',
				content: {
					'application/json': {
						schema: z.object({ success: z.boolean(), provider: authProviderSchema })
					}
				}
			},
			400: {
				description: 'Missing required fields or invalid configuration',
				content: { 'application/json': { schema: z.object({ message: z.string() }) } }
			},
			401: { description: 'Unauthorized' },
			403: { description: 'Admin access required' }
		}
	}
};
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
