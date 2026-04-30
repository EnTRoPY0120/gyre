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
import { parseRoleMappingInput } from '$lib/auth/role-mapping';
import { parseRoleMappingSafe } from '$lib/server/auth/role-mapping';
import { accounts, authProviders } from '$lib/server/db/schema';
import { encryptSecret } from '$lib/server/auth/crypto';
import { validateProviderConfig } from '$lib/server/auth/oauth';
import { eq } from 'drizzle-orm';
import {
	logPrivilegedMutationSuccess,
	requirePrivilegedAdminPermission
} from '$lib/server/http/guards.js';

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
	await requirePrivilegedAdminPermission(locals, 'AuthProvider');

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
			roleMapping: parseRoleMappingSafe(provider.roleMapping, provider.id)
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
	const user = await requirePrivilegedAdminPermission(locals, 'AuthProvider');

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
		// Build applied update object (only include known, provided fields)
		const appliedUpdate: Record<string, unknown> = {};

		// Update fields if provided
		if (body.name !== undefined) appliedUpdate.name = body.name;
		if (body.type !== undefined) appliedUpdate.type = body.type;
		if (body.enabled !== undefined) appliedUpdate.enabled = body.enabled;
		if (body.clientId !== undefined) appliedUpdate.clientId = body.clientId;
		if (body.issuerUrl !== undefined) appliedUpdate.issuerUrl = body.issuerUrl;
		if (body.authorizationUrl !== undefined) appliedUpdate.authorizationUrl = body.authorizationUrl;
		if (body.tokenUrl !== undefined) appliedUpdate.tokenUrl = body.tokenUrl;
		if (body.userInfoUrl !== undefined) appliedUpdate.userInfoUrl = body.userInfoUrl;
		if (body.jwksUrl !== undefined) appliedUpdate.jwksUrl = body.jwksUrl;
		if (body.autoProvision !== undefined) appliedUpdate.autoProvision = body.autoProvision;
		if (body.defaultRole !== undefined) appliedUpdate.defaultRole = body.defaultRole;
		if (body.roleMapping !== undefined) {
			try {
				const parsedRoleMapping = parseRoleMappingInput(body.roleMapping);
				appliedUpdate.roleMapping = parsedRoleMapping ? JSON.stringify(parsedRoleMapping) : null;
			} catch (parseError) {
				throw error(400, {
					message:
						parseError instanceof Error
							? parseError.message
							: 'roleMapping must be an object mapping role names to arrays of group strings'
				});
			}
		}
		if (body.roleClaim !== undefined) appliedUpdate.roleClaim = body.roleClaim;
		if (body.usernameClaim !== undefined) appliedUpdate.usernameClaim = body.usernameClaim;
		if (body.emailClaim !== undefined) appliedUpdate.emailClaim = body.emailClaim;
		if (body.usePkce !== undefined) appliedUpdate.usePkce = body.usePkce;
		if (body.scopes !== undefined) appliedUpdate.scopes = body.scopes;

		// Handle client secret separately (needs encryption)
		if (typeof body.clientSecret === 'string' && body.clientSecret.trim().length > 0) {
			appliedUpdate.clientSecretEncrypted = encryptSecret(body.clientSecret);
		}
		const changedKeys = Object.keys(appliedUpdate).filter((key) => key !== 'clientSecretEncrypted');
		const updatePayload: Record<string, unknown> = { ...appliedUpdate, updatedAt: new Date() };

		// Validate updated configuration
		const updatedConfig = { ...existingProvider, ...updatePayload };
		const validation = validateProviderConfig(updatedConfig);
		if (!validation.valid) {
			throw error(400, { message: validation.errors.join(', ') });
		}

		// Update in database
		await db.update(authProviders).set(updatePayload).where(eq(authProviders.id, params.id));

		logger.info({ providerId: params.id }, 'Updated auth provider');

		// Fetch updated provider
		const updatedProvider = await db.query.authProviders.findFirst({
			where: eq(authProviders.id, params.id)
		});
		await logPrivilegedMutationSuccess({
			action: 'auth-provider:update',
			user,
			resourceType: 'AuthProvider',
			name: updatedProvider?.name ?? existingProvider.name,
			details: {
				providerId: params.id,
				changedKeys,
				clientSecretUpdated: !!appliedUpdate.clientSecretEncrypted
			}
		});

		return json({
			success: true,
			provider: {
				...updatedProvider,
				clientSecretEncrypted: '***',
				roleMapping: parseRoleMappingSafe(updatedProvider?.roleMapping, params.id)
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
	const user = await requirePrivilegedAdminPermission(locals, 'AuthProvider');

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
		await logPrivilegedMutationSuccess({
			action: 'auth-provider:delete',
			user,
			resourceType: 'AuthProvider',
			name: provider.name,
			details: {
				providerId: params.id,
				providerType: provider.type
			}
		});

		logger.info({ providerId: params.id, providerName: provider.name }, 'Deleted auth provider');

		return json({ success: true });
	} catch (err) {
		if (isHttpError(err) || isRedirect(err)) throw err;

		logger.error(err, 'Failed to delete auth provider:');
		throw error(500, { message: 'Failed to delete provider' });
	}
};
