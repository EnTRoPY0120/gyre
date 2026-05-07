/**
 * Admin Settings API
 * Allows admins to view and update application settings.
 */

import { logger } from '$lib/server/logger.js';
import { json, error } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import {
	getAuthSettings,
	getAuditLogRetentionDays,
	setSettings,
	SETTINGS_KEYS,
	isSettingOverriddenByEnv,
	SETTING_ENV_OVERRIDES
} from '$lib/server/settings';
import {
	enforceUserRateLimitPreset,
	logPrivilegedMutationSuccess,
	requirePrivilegedAdminPermission
} from '$lib/server/http/guards.js';

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
			400: { description: 'Invalid request body' },
			401: { description: 'Unauthorized' },
			409: { description: 'Setting is locked by environment variable' },
			403: { description: 'Admin access required' }
		}
	}
};

const PUBLIC_SETTING_MAP = {
	localLoginEnabled: SETTINGS_KEYS.AUTH_LOCAL_LOGIN_ENABLED,
	allowSignup: SETTINGS_KEYS.AUTH_ALLOW_SIGNUP,
	domainAllowlist: SETTINGS_KEYS.AUTH_DOMAIN_ALLOWLIST,
	auditRetentionDays: SETTINGS_KEYS.AUDIT_LOG_RETENTION_DAYS
} as const;

type PublicSettingKey = keyof typeof PUBLIC_SETTING_MAP;

function normalizeSettingsPayload(body: unknown): {
	requestedKeys: string[];
	updates: Array<{ key: string; value: string }>;
} {
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		throw error(400, { message: 'Invalid request body' });
	}

	const requestedKeys = Object.keys(body);
	const unknownKeys = requestedKeys.filter((key) => !(key in PUBLIC_SETTING_MAP));
	if (unknownKeys.length > 0) {
		throw error(400, { message: `Unknown setting field(s): ${unknownKeys.join(', ')}` });
	}

	const payload = body as Record<string, unknown>;
	const updates: Array<{ key: string; value: string }> = [];

	if ('localLoginEnabled' in payload) {
		if (typeof payload.localLoginEnabled !== 'boolean') {
			throw error(400, { message: 'localLoginEnabled must be a boolean' });
		}
		updates.push({
			key: SETTINGS_KEYS.AUTH_LOCAL_LOGIN_ENABLED,
			value: String(payload.localLoginEnabled)
		});
	}

	if ('allowSignup' in payload) {
		if (typeof payload.allowSignup !== 'boolean') {
			throw error(400, { message: 'allowSignup must be a boolean' });
		}
		updates.push({ key: SETTINGS_KEYS.AUTH_ALLOW_SIGNUP, value: String(payload.allowSignup) });
	}

	if ('domainAllowlist' in payload) {
		if (!Array.isArray(payload.domainAllowlist)) {
			throw error(400, { message: 'domainAllowlist must be an array of strings' });
		}
		if (!payload.domainAllowlist.every((domain) => typeof domain === 'string')) {
			throw error(400, { message: 'domainAllowlist entries must be strings' });
		}
		const domains = payload.domainAllowlist
			.map((domain) => domain.trim().toLowerCase())
			.filter((domain) => domain.length > 0);
		const uniqueDomains = [...new Set(domains)];
		updates.push({
			key: SETTINGS_KEYS.AUTH_DOMAIN_ALLOWLIST,
			value: JSON.stringify(uniqueDomains)
		});
	}

	if ('auditRetentionDays' in payload) {
		if (
			typeof payload.auditRetentionDays !== 'number' ||
			!Number.isFinite(payload.auditRetentionDays)
		) {
			throw error(400, { message: 'auditRetentionDays must be a finite number' });
		}
		const retention = Math.floor(payload.auditRetentionDays);
		if (retention < 1 || retention > 3650) {
			throw error(400, { message: 'auditRetentionDays must be between 1 and 3650' });
		}
		updates.push({ key: SETTINGS_KEYS.AUDIT_LOG_RETENTION_DAYS, value: String(retention) });
	}

	const lockedFields = requestedKeys.filter((key) =>
		isSettingOverriddenByEnv(PUBLIC_SETTING_MAP[key as PublicSettingKey])
	);
	if (lockedFields.length > 0) {
		const details = lockedFields.map((key) => {
			const settingKey = PUBLIC_SETTING_MAP[key as PublicSettingKey];
			return `${key} (${SETTING_ENV_OVERRIDES[settingKey]})`;
		});
		throw error(409, {
			message: `Setting field(s) are locked by environment variable: ${details.join(', ')}`
		});
	}

	return { requestedKeys, updates };
}

/**
 * GET /api/admin/settings
 * Returns all application settings (admin only)
 */
export const GET: RequestHandler = async ({ locals }) => {
	await requirePrivilegedAdminPermission({ ...locals, cluster: undefined });

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
	const user = await requirePrivilegedAdminPermission({ ...locals, cluster: undefined });
	enforceUserRateLimitPreset({ setHeaders }, locals, 'admin');

	try {
		let body;
		try {
			body = await request.json();
		} catch {
			throw error(400, { message: 'Invalid JSON body' });
		}

		const { requestedKeys, updates } = normalizeSettingsPayload(body);
		await setSettings(updates);
		const changedKeys = updates.map((update) => update.key);

		// Return updated settings
		const [authSettings, auditRetentionDays] = await Promise.all([
			getAuthSettings(),
			getAuditLogRetentionDays()
		]);
		await logPrivilegedMutationSuccess({
			action: 'settings:update',
			user,
			resourceType: 'AppSettings',
			details: {
				requestedKeys,
				changedKeys
			}
		});
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
