/**
 * Admin Settings API
 * Allows admins to view and update application settings.
 */

import { json, error } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import {
	getAuthSettings,
	setSetting,
	SETTINGS_KEYS,
	isSettingOverriddenByEnv
} from '$lib/server/settings';
import { requirePermission } from '$lib/server/rbac';

export const _metadata = {
	GET: {
		summary: 'Get application settings',
		description: 'Retrieve all application settings. Admin access required.',
		tags: ['Admin'],
		responses: {
			200: {
				description: 'Application settings',
				content: {
					'application/json': {
						schema: z.object({
							settings: z.object({
								localLoginEnabled: z.object({ value: z.boolean(), overriddenByEnv: z.boolean() }),
								allowSignup: z.object({ value: z.boolean(), overriddenByEnv: z.boolean() }),
								domainAllowlist: z.object({
									value: z.array(z.string()),
									overriddenByEnv: z.boolean()
								})
							})
						})
					}
				}
			},
			400: { description: 'Missing cluster context' },
			401: { description: 'Unauthorized' },
			403: { description: 'Admin access required' }
		}
	},
	PATCH: {
		summary: 'Update application settings',
		description: 'Update application settings. Admin access required.',
		tags: ['Admin'],
		request: {
			body: {
				content: {
					'application/json': {
						schema: z.object({
							localLoginEnabled: z.boolean().optional(),
							allowSignup: z.boolean().optional(),
							domainAllowlist: z.array(z.string()).optional()
						})
					}
				}
			}
		},
		responses: {
			200: {
				description: 'Settings updated successfully',
				content: {
					'application/json': {
						schema: z.any()
					}
				}
			},
			400: { description: 'Invalid request or missing cluster context' },
			401: { description: 'Unauthorized' },
			403: { description: 'Admin access required' }
		}
	}
};

/**
 * GET /api/admin/settings
 * Returns all application settings (admin only)
 */
export const GET: RequestHandler = async ({ locals }) => {
	// Check authentication
	if (!locals.user) {
		throw error(401, { message: 'Unauthorized' });
	}

	if (!locals.cluster) {
		throw error(400, { message: 'Missing cluster context' });
	}

	// Check admin role
	if (locals.user.role !== 'admin') {
		throw error(403, { message: 'Admin access required' });
	}

	// Enforce RBAC
	await requirePermission(locals.user, 'admin', undefined, undefined, locals.cluster);

	try {
		const authSettings = await getAuthSettings();

		// Include override status for UI
		return json({
			settings: {
				localLoginEnabled: {
					value: authSettings.localLoginEnabled,
					overriddenByEnv: isSettingOverriddenByEnv(SETTINGS_KEYS.AUTH_LOCAL_LOGIN_ENABLED)
				},
				allowSignup: {
					value: authSettings.allowSignup,
					overriddenByEnv: isSettingOverriddenByEnv(SETTINGS_KEYS.AUTH_ALLOW_SIGNUP)
				},
				domainAllowlist: {
					value: authSettings.domainAllowlist,
					overriddenByEnv: isSettingOverriddenByEnv(SETTINGS_KEYS.AUTH_DOMAIN_ALLOWLIST)
				}
			}
		});
	} catch (err) {
		console.error('Failed to load settings:', err);
		throw error(500, { message: 'Failed to load settings' });
	}
};

/**
 * PATCH /api/admin/settings
 * Updates application settings (admin only)
 */
export const PATCH: RequestHandler = async ({ locals, request }) => {
	// Check authentication
	if (!locals.user) {
		throw error(401, { message: 'Unauthorized' });
	}

	if (!locals.cluster) {
		throw error(400, { message: 'Missing cluster context' });
	}

	// Check admin role
	if (locals.user.role !== 'admin') {
		throw error(403, { message: 'Admin access required' });
	}

	// Enforce RBAC
	await requirePermission(locals.user, 'admin', undefined, undefined, locals.cluster);

	try {
		let body;
		try {
			body = await request.json();
		} catch {
			throw error(400, { message: 'Invalid JSON body' });
		}

		// Validate input
		if (!body || typeof body !== 'object') {
			throw error(400, { message: 'Invalid request body' });
		}

		// Update settings
		if (typeof body.localLoginEnabled === 'boolean') {
			if (!isSettingOverriddenByEnv(SETTINGS_KEYS.AUTH_LOCAL_LOGIN_ENABLED)) {
				await setSetting(SETTINGS_KEYS.AUTH_LOCAL_LOGIN_ENABLED, String(body.localLoginEnabled));
			}
		}

		if (typeof body.allowSignup === 'boolean') {
			if (!isSettingOverriddenByEnv(SETTINGS_KEYS.AUTH_ALLOW_SIGNUP)) {
				await setSetting(SETTINGS_KEYS.AUTH_ALLOW_SIGNUP, String(body.allowSignup));
			}
		}

		if (Array.isArray(body.domainAllowlist)) {
			if (!isSettingOverriddenByEnv(SETTINGS_KEYS.AUTH_DOMAIN_ALLOWLIST)) {
				// Validate domains
				const domains = body.domainAllowlist
					.filter((d: unknown) => typeof d === 'string')
					.map((d: string) => d.trim().toLowerCase())
					.filter((d: string) => d.length > 0);

				const uniqueDomains = [...new Set(domains)];
				await setSetting(SETTINGS_KEYS.AUTH_DOMAIN_ALLOWLIST, JSON.stringify(uniqueDomains));
			}
		}

		// Return updated settings
		const authSettings = await getAuthSettings();
		return json({
			settings: {
				localLoginEnabled: {
					value: authSettings.localLoginEnabled,
					overriddenByEnv: isSettingOverriddenByEnv(SETTINGS_KEYS.AUTH_LOCAL_LOGIN_ENABLED)
				},
				allowSignup: {
					value: authSettings.allowSignup,
					overriddenByEnv: isSettingOverriddenByEnv(SETTINGS_KEYS.AUTH_ALLOW_SIGNUP)
				},
				domainAllowlist: {
					value: authSettings.domainAllowlist,
					overriddenByEnv: isSettingOverriddenByEnv(SETTINGS_KEYS.AUTH_DOMAIN_ALLOWLIST)
				}
			}
		});
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		console.error('Failed to update settings:', err);
		throw error(500, { message: 'Failed to update settings' });
	}
};
