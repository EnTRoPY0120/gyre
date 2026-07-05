import {
	getAuthSettings,
	getAuditLogRetentionDays,
	isSettingOverriddenByEnv,
	SETTINGS_KEYS
} from '$lib/server/settings';

export async function serializePublicSettings() {
	const [authSettings, auditRetentionDays] = await Promise.all([
		getAuthSettings(),
		getAuditLogRetentionDays()
	]);

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
			},
			auditRetentionDays: {
				value: auditRetentionDays,
				overriddenByEnv: isSettingOverriddenByEnv(SETTINGS_KEYS.AUDIT_LOG_RETENTION_DAYS)
			}
		}
	};
}
