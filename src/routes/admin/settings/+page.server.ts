import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { getAuthSettings, isSettingOverriddenByEnv, SETTINGS_KEYS } from '$lib/server/settings';

/**
 * Load settings for admin page
 */
export const load: PageServerLoad = async ({ locals }) => {
	// Check authentication
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	// Check admin role
	if (locals.user.role !== 'admin') {
		throw error(403, { message: 'Admin access required' });
	}

	try {
		const authSettings = await getAuthSettings();

		return {
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
		};
	} catch (err) {
		console.error('Failed to load settings:', err);
		throw error(500, { message: 'Failed to load settings' });
	}
};
