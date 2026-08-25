/**
 * Admin Settings API
 * Allows admins to view and update application settings.
 */

import { logger } from '$lib/server/logger.js';
import { json, error } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { setSettings } from '$lib/server/settings';
import { serializePublicSettings } from '$lib/server/settings/serialization';
import { normalizeSettingsPayload } from './settings-payload.js';
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

/**
 * GET /api/admin/settings
 * Returns all application settings (admin only)
 */
export const GET: RequestHandler = async ({ locals }) => {
	await requirePrivilegedAdminPermission({ ...locals, cluster: undefined });

	try {
		return json(await serializePublicSettings());
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
		if (updates.length === 0) {
			return json(await serializePublicSettings());
		}

		await setSettings(updates);
		const changedKeys = updates.map((update) => update.key);
		await logPrivilegedMutationSuccess({
			action: 'settings:update',
			user,
			resourceType: 'AppSettings',
			details: {
				requestedKeys,
				changedKeys
			}
		});

		// Return updated settings
		return json(await serializePublicSettings());
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		logger.error(err, 'Failed to update settings:');
		throw error(500, { message: 'Failed to update settings' });
	}
};
