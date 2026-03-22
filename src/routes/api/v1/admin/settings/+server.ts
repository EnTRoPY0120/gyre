/**
 * Admin Settings API
 * Allows admins to view and update application settings.
 */

import { logger } from '$lib/server/logger.js';
import { json, error } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { checkRateLimit } from '$lib/server/rate-limiter';
import {
	getAuthSettings,
	getAuditLogRetentionDays,
	setSetting,
	SETTINGS_KEYS,
	isSettingOverriddenByEnv
} from '$lib/server/settings';
import { checkPermission } from '$lib/server/rbac';

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
								}),
								auditRetentionDays: z.object({ value: z.number(), overriddenByEnv: z.boolean() })
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
							domainAllowlist: z.array(z.string()).optional(),
							auditRetentionDays: z.number().optional()
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

	// Enforce RBAC (checkPermission short-circuits for admin role)
	const hasPermission = await checkPermission(
		locals.user,
		'admin',
		undefined,
		undefined,
		locals.cluster
	);
	if (!hasPermission) {
		throw error(403, { message: 'Forbidden: admin permission required' });
	}

	try {
		const [authSettings, auditRetentionDays] = await Promise.all([
			getAuthSettings(),
			getAuditLogRetentionDays()
		]);

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
				},
				auditRetentionDays: {
					value: auditRetentionDays,
					overriddenByEnv: isSettingOverriddenByEnv(SETTINGS_KEYS.AUDIT_LOG_RETENTION_DAYS)
				}
			}
		});
	} catch (err) {
		logger.error(err, 'Failed to load settings:');
		throw error(500, { message: 'Failed to load settings' });
	}
};

/**
 * PATCH /api/admin/settings
 * Updates application settings (admin only)
 */
export const PATCH: RequestHandler = async ({ locals, request, setHeaders }) => {
	// Check authentication
	if (!locals.user) {
		throw error(401, { message: 'Unauthorized' });
	}

	if (!locals.cluster) {
		throw error(400, { message: 'Missing cluster context' });
	}

	checkRateLimit({ setHeaders }, `admin:${locals.user.id}`, 20, 60 * 1000);

	// Enforce RBAC (checkPermission short-circuits for admin role)
	const hasPermission = await checkPermission(
		locals.user,
		'admin',
		undefined,
		undefined,
		locals.cluster
	);
	if (!hasPermission) {
		throw error(403, { message: 'Forbidden: admin permission required' });
	}

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

		if (typeof body.auditRetentionDays === 'number') {
			if (!isSettingOverriddenByEnv(SETTINGS_KEYS.AUDIT_LOG_RETENTION_DAYS)) {
				if (!Number.isFinite(body.auditRetentionDays)) {
					throw error(400, { message: 'Audit retention days must be a finite number' });
				}

				const retention = Math.floor(body.auditRetentionDays);
				// Validate range (1-3650 days)
				if (retention < 1 || retention > 3650) {
					throw error(400, { message: 'Audit retention days must be between 1 and 3650' });
				}

				await setSetting(SETTINGS_KEYS.AUDIT_LOG_RETENTION_DAYS, String(retention));
			}
		}

		// Return updated settings
		const [authSettings, auditRetentionDays] = await Promise.all([
			getAuthSettings(),
			getAuditLogRetentionDays()
		]);
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
				},
				auditRetentionDays: {
					value: auditRetentionDays,
					overriddenByEnv: isSettingOverriddenByEnv(SETTINGS_KEYS.AUDIT_LOG_RETENTION_DAYS)
				}
			}
		});
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		logger.error(err, 'Failed to update settings:');
		throw error(500, { message: 'Failed to update settings' });
	}
};
