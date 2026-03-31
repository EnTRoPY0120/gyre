/**
 * Individual Auth Provider Management API
 * Get, update, or delete a specific auth provider.
 * Admin-only endpoints.
 */

import { logger } from '$lib/server/logger.js';
import { json, error, isHttpError, isRedirect } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import { authProviderSchema } from '$lib/server/auth/schemas';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { accounts, authProviders } from '$lib/server/db/schema';
import { encryptSecret } from '$lib/server/auth/crypto';
import { validateProviderConfig } from '$lib/server/auth/oauth';
import { eq } from 'drizzle-orm';
import { checkPermission } from '$lib/server/rbac.js';

export const _metadata = {
	GET: {
		summary: 'Get auth provider',
		description: 'Retrieve a specific auth provider by ID. Admin access required.',
		tags: ['Admin'],
		request: {
			params: z.object({ id: z.string().openapi({ example: 'abc123def456' }) })
		},
		responses: {
			200: {
				description: 'Auth provider details (client secret redacted)',
				content: {
					'application/json': {
						schema: z.object({ provider: authProviderSchema })
					}
				}
			},
			401: { description: 'Unauthorized' },
			403: { description: 'Admin access required' },
			404: { description: 'Provider not found' },
			500: { description: 'Internal server error' }
		}
	},
	PATCH: {
		summary: 'Update auth provider',
		description:
			'Update an existing auth provider. Only include fields that need to be changed. If clientSecret is provided, it will be re-encrypted. Admin access required.',
		tags: ['Admin'],
		request: {
			params: z.object({ id: z.string().openapi({ example: 'abc123def456' }) }),
			body: {
				content: {
					'application/json': {
						schema: z.object({
							name: z.string().optional(),
							type: z
								.enum(['oidc', 'oauth2-github', 'oauth2-google', 'oauth2-gitlab', 'oauth2-generic'])
								.optional(),
							enabled: z.boolean().optional(),
							clientId: z.string().optional(),
							clientSecret: z.string().optional(),
							issuerUrl: z.string().nullable().optional(),
							authorizationUrl: z.string().nullable().optional(),
							tokenUrl: z.string().nullable().optional(),
							userInfoUrl: z.string().nullable().optional(),
							jwksUrl: z.string().nullable().optional(),
							autoProvision: z.boolean().optional(),
							defaultRole: z.enum(['admin', 'editor', 'viewer']).optional(),
							roleMapping: z.record(z.string(), z.array(z.string())).nullable().optional(),
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
				description: 'Provider updated successfully',
				content: {
					'application/json': {
						schema: z.object({ success: z.boolean(), provider: authProviderSchema })
					}
				}
			},
			400: { description: 'Invalid configuration' },
			401: { description: 'Unauthorized' },
			403: { description: 'Admin access required' },
			404: { description: 'Provider not found' },
			500: { description: 'Internal server error' }
		}
	},
	DELETE: {
		summary: 'Delete auth provider',
		description:
			'Permanently delete an auth provider. All associated user SSO links will also be removed. Admin access required.',
		tags: ['Admin'],
		request: {
			params: z.object({ id: z.string().openapi({ example: 'abc123def456' }) })
		},
		responses: {
			200: {
				description: 'Provider deleted successfully',
				content: {
					'application/json': {
						schema: z.object({ success: z.boolean() })
					}
				}
			},
			401: { description: 'Unauthorized' },
			403: { description: 'Admin access required' },
			404: { description: 'Provider not found' },
			500: { description: 'Internal server error' }
		}
	}
};

/**
 * GET /api/admin/auth-providers/[id]
 * Get a specific auth provider (admin only)
 */
export const GET: RequestHandler = async ({ params, locals }) => {
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
		const provider = await db.query.authProviders.findFirst({
			where: eq(authProviders.id, params.id)
		});

		if (!provider) {
			throw error(404, { message: 'Provider not found' });
		}

		// Remove sensitive data and parse roleMapping back to object
		const sanitizedProvider = {
			...provider,
			clientSecretEncrypted: '***',
			roleMapping: (() => {
				if (!provider.roleMapping) return null;
				try {
					return JSON.parse(provider.roleMapping);
				} catch {
					logger.warn({ providerId: provider.id }, '[auth-providers] Malformed roleMapping JSON');
					return null;
				}
			})()
		};

		return json({ provider: sanitizedProvider });
	} catch (err) {
		if (isHttpError(err) || isRedirect(err)) throw err;

		logger.error(err, 'Failed to get auth provider:');
		throw error(500, { message: 'Failed to load provider' });
	}
};

/**
 * PATCH /api/admin/auth-providers/[id]
 * Update an auth provider (admin only)
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
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

		// Check if provider exists
		const existingProvider = await db.query.authProviders.findFirst({
			where: eq(authProviders.id, params.id)
		});

		if (!existingProvider) {
			throw error(404, { message: 'Provider not found' });
		}

		const body = await request.json();

		// Build update object (only include provided fields)
		const updates: Record<string, unknown> = {
			updatedAt: new Date()
		};

		// Update fields if provided
		if (body.name !== undefined) updates.name = body.name;
		if (body.type !== undefined) updates.type = body.type;
		if (body.enabled !== undefined) updates.enabled = body.enabled;
		if (body.clientId !== undefined) updates.clientId = body.clientId;
		if (body.issuerUrl !== undefined) updates.issuerUrl = body.issuerUrl;
		if (body.authorizationUrl !== undefined) updates.authorizationUrl = body.authorizationUrl;
		if (body.tokenUrl !== undefined) updates.tokenUrl = body.tokenUrl;
		if (body.userInfoUrl !== undefined) updates.userInfoUrl = body.userInfoUrl;
		if (body.jwksUrl !== undefined) updates.jwksUrl = body.jwksUrl;
		if (body.autoProvision !== undefined) updates.autoProvision = body.autoProvision;
		if (body.defaultRole !== undefined) updates.defaultRole = body.defaultRole;
		if (body.roleMapping !== undefined) {
			if (body.roleMapping !== null) {
				const roleMappingSchema = z.record(z.string(), z.array(z.string()));
				const result = roleMappingSchema.safeParse(body.roleMapping);
				if (!result.success) {
					throw error(400, {
						message: 'roleMapping must be an object mapping role names to arrays of group strings'
					});
				}
				updates.roleMapping = JSON.stringify(result.data);
			} else {
				updates.roleMapping = null;
			}
		}
		if (body.roleClaim !== undefined) updates.roleClaim = body.roleClaim;
		if (body.usernameClaim !== undefined) updates.usernameClaim = body.usernameClaim;
		if (body.emailClaim !== undefined) updates.emailClaim = body.emailClaim;
		if (body.usePkce !== undefined) updates.usePkce = body.usePkce;
		if (body.scopes !== undefined) updates.scopes = body.scopes;

		// Handle client secret separately (needs encryption)
		if (body.clientSecret) {
			updates.clientSecretEncrypted = encryptSecret(body.clientSecret);
		}

		// Validate updated configuration
		const updatedConfig = { ...existingProvider, ...updates };
		const validation = validateProviderConfig(updatedConfig);
		if (!validation.valid) {
			throw error(400, { message: validation.errors.join(', ') });
		}

		// Update in database
		await db.update(authProviders).set(updates).where(eq(authProviders.id, params.id));

		logger.info({ providerId: params.id }, 'Updated auth provider');

		// Fetch updated provider
		const updatedProvider = await db.query.authProviders.findFirst({
			where: eq(authProviders.id, params.id)
		});

		return json({
			success: true,
			provider: {
				...updatedProvider,
				clientSecretEncrypted: '***',
				roleMapping: (() => {
					if (!updatedProvider?.roleMapping) return null;
					try {
						return JSON.parse(updatedProvider.roleMapping);
					} catch {
						logger.warn({ providerId: params.id }, '[auth-providers] Malformed roleMapping JSON');
						return null;
					}
				})()
			}
		});
	} catch (err) {
		if (isHttpError(err) || isRedirect(err)) throw err;

		logger.error(err, 'Failed to update auth provider:');
		throw error(500, { message: 'Failed to update provider' });
	}
};

/**
 * DELETE /api/admin/auth-providers/[id]
 * Delete an auth provider (admin only)
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
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

		// Check if provider exists
		const provider = await db.query.authProviders.findFirst({
			where: eq(authProviders.id, params.id)
		});

		if (!provider) {
			throw error(404, { message: 'Provider not found' });
		}

		await db.transaction((tx) => {
			tx.delete(accounts).where(eq(accounts.providerId, params.id)).run();
			tx.delete(authProviders).where(eq(authProviders.id, params.id)).run();
		});

		logger.info({ providerId: params.id, providerName: provider.name }, 'Deleted auth provider');

		return json({ success: true });
	} catch (err) {
		if (isHttpError(err) || isRedirect(err)) throw err;

		logger.error(err, 'Failed to delete auth provider:');
		throw error(500, { message: 'Failed to delete provider' });
	}
};
