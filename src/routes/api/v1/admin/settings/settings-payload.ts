import { error } from '@sveltejs/kit';
import {
	SETTINGS_KEYS,
	SETTING_ENV_OVERRIDES,
	isSettingOverriddenByEnv
} from '$lib/server/settings';

const PUBLIC_SETTING_MAP = {
	localLoginEnabled: SETTINGS_KEYS.AUTH_LOCAL_LOGIN_ENABLED,
	allowSignup: SETTINGS_KEYS.AUTH_ALLOW_SIGNUP,
	domainAllowlist: SETTINGS_KEYS.AUTH_DOMAIN_ALLOWLIST,
	auditRetentionDays: SETTINGS_KEYS.AUDIT_LOG_RETENTION_DAYS
} as const;

type PublicSettingKey = keyof typeof PUBLIC_SETTING_MAP;

type SettingUpdate = { key: string; value: string };

function appendBooleanSetting(
	payload: Record<string, unknown>,
	field: 'localLoginEnabled' | 'allowSignup',
	key: string,
	updates: SettingUpdate[]
): void {
	if (!(field in payload)) return;
	if (typeof payload[field] !== 'boolean') {
		throw error(400, { message: `${field} must be a boolean` });
	}
	updates.push({ key, value: String(payload[field]) });
}

function appendDomainAllowlist(payload: Record<string, unknown>, updates: SettingUpdate[]): void {
	if (!('domainAllowlist' in payload)) return;
	if (!Array.isArray(payload.domainAllowlist)) {
		throw error(400, { message: 'domainAllowlist must be an array of strings' });
	}
	if (!payload.domainAllowlist.every((domain) => typeof domain === 'string')) {
		throw error(400, { message: 'domainAllowlist entries must be strings' });
	}
	const domains = payload.domainAllowlist
		.map((domain) => domain.trim().toLowerCase())
		.filter((domain) => domain.length > 0);
	updates.push({
		key: SETTINGS_KEYS.AUTH_DOMAIN_ALLOWLIST,
		value: JSON.stringify([...new Set(domains)])
	});
}

function appendAuditRetention(payload: Record<string, unknown>, updates: SettingUpdate[]): void {
	if (!('auditRetentionDays' in payload)) return;
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

export function normalizeSettingsPayload(body: unknown): {
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
	const updates: SettingUpdate[] = [];
	appendBooleanSetting(
		payload,
		'localLoginEnabled',
		SETTINGS_KEYS.AUTH_LOCAL_LOGIN_ENABLED,
		updates
	);
	appendBooleanSetting(payload, 'allowSignup', SETTINGS_KEYS.AUTH_ALLOW_SIGNUP, updates);
	appendDomainAllowlist(payload, updates);
	appendAuditRetention(payload, updates);

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
