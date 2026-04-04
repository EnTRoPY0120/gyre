/**
 * Auth Providers Management API
 * CRUD operations for SSO provider configuration.
 * Admin-only endpoints.
 */

import { logger } from '$lib/server/logger.js';
import { json, error, isHttpError, isRedirect } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import { authProviderSchema, providerTypeSchema } from '$lib/server/auth/schemas';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { parseRoleMappingInput } from '$lib/auth/role-mapping';
import { parseRoleMappingSafe } from '$lib/server/auth/role-mapping';

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
			403: { description: 'Admin access required' },
			500: { description: 'Internal server error' }
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
							roleMapping: z.record(z.string(), z.array(z.string())).optional(),
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
			403: { description: 'Admin access required' },
			500: { description: 'Internal server error' }
		}
	}
};
import { authProviders, type NewAuthProvider } from '$lib/server/db/schema';
import { encryptSecret } from '$lib/server/auth/crypto';
import { validateProviderConfig } from '$lib/server/auth/oauth';
import { randomBytes } from 'node:crypto';
import { checkRateLimit } from '$lib/server/rate-limiter';

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
	// Check authentication (hook enforces admin role for /api/v1/admin/* routes)
	if (!locals.user) {
		throw error(401, { message: 'Unauthorized' });
	}

	try {
		const db = await getDb();
		const providers = await db.query.authProviders.findMany({
			orderBy: (authProviders, { asc }) => [asc(authProviders.name)]
		});

		// Remove sensitive data before sending to client
		const sanitizedProviders = providers.map((p) => ({
			...p,
			clientSecretEncrypted: '***', // Don't send encrypted secret to client
			roleMapping: parseRoleMappingSafe(p.roleMapping, p.id)
		}));

		return json({ providers: sanitizedProviders });
	} catch (err) {
		logger.error(err, 'Failed to list auth providers:');
		throw error(500, { message: 'Failed to load providers' });
	}
};

/**
 * POST /api/admin/auth-providers
 * Create a new auth provider (admin only)
 */
export const POST: RequestHandler = async ({ request, locals, setHeaders }) => {
	// Check authentication (hook enforces admin role for /api/v1/admin/* routes)
	if (!locals.user) {
		throw error(401, { message: 'Unauthorized' });
	}

	checkRateLimit({ setHeaders }, `admin:${locals.user.id}`, 20, 60 * 1000);

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

		let validatedRoleMapping: Record<string, string[]> | null = null;
		try {
			validatedRoleMapping = parseRoleMappingInput(roleMapping);
		} catch (parseError) {
			throw error(400, {
				message:
					parseError instanceof Error
						? parseError.message
						: 'roleMapping must be an object mapping role names to arrays of group strings'
			});
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
			roleMapping: validatedRoleMapping ? JSON.stringify(validatedRoleMapping) : null,
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

		logger.info(`Created new auth provider: ${name} (${type})`);

		return json({
			success: true,
			provider: {
				...newProvider,
				clientSecretEncrypted: '***', // Don't send back to client
				roleMapping: validatedRoleMapping
			}
		});
	} catch (err) {
		if (isHttpError(err) || isRedirect(err)) throw err;

		logger.error(err, 'Failed to create auth provider:');

		throw error(500, { message: 'Failed to create provider' });
	}
};
