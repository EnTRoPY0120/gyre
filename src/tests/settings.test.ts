import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { importFresh } from './helpers/import-fresh';

vi.spyOn(console, 'log').mockImplementation(() => {});

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

// Mutable reference shared with the mock closure so each test gets a fresh DB
const state: {
	db: ReturnType<typeof drizzle<typeof schema>> | null;
	sqlite: Database | null;
} = { db: null, sqlite: null };
type SettingsModule = typeof import('../lib/server/settings.js');
let setSettings: SettingsModule['setSettings'];
let getAuthSettings: SettingsModule['getAuthSettings'];
let getAuditLogRetentionDays: SettingsModule['getAuditLogRetentionDays'];
let isSettingOverriddenByEnv: SettingsModule['isSettingOverriddenByEnv'];
let seedAuthSettings: SettingsModule['seedAuthSettings'];
let SETTINGS_KEYS: SettingsModule['SETTINGS_KEYS'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CREATE_APP_SETTINGS = `
	CREATE TABLE IF NOT EXISTS app_settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL,
		updated_at INTEGER NOT NULL DEFAULT (unixepoch())
	)
`;

function setupInMemoryDb() {
	const sqlite = new Database(':memory:');
	state.sqlite = sqlite;
	sqlite.exec(CREATE_APP_SETTINGS);
	return drizzle(sqlite, { schema });
}

async function setSingleSetting(key: string, value: string) {
	await setSettings([{ key, value }]);
}

// Env var save/restore helpers
let savedEnv: Record<string, string | undefined> = {};

function setEnv(key: string, value: string) {
	savedEnv[key] = process.env[key];
	process.env[key] = value;
}

function unsetEnv(key: string) {
	savedEnv[key] = process.env[key];
	delete process.env[key];
}

beforeEach(async () => {
	vi.restoreAllMocks();
	vi.resetModules();
	state.db = setupInMemoryDb();
	savedEnv = {};
	vi.doMock('../lib/server/db/index.js', () => ({
		getDb: async () => state.db,
		getDbSync: () => state.db,
		schema
	}));
	const settingsModule = await importFresh<SettingsModule>('../lib/server/settings.js?sut');
	setSettings = settingsModule.setSettings;
	getAuthSettings = settingsModule.getAuthSettings;
	getAuditLogRetentionDays = settingsModule.getAuditLogRetentionDays;
	isSettingOverriddenByEnv = settingsModule.isSettingOverriddenByEnv;
	seedAuthSettings = settingsModule.seedAuthSettings;
	SETTINGS_KEYS = settingsModule.SETTINGS_KEYS;
	// Ensure env overrides are cleared before each test
	unsetEnv('GYRE_AUTH_LOCAL_LOGIN_ENABLED');
	unsetEnv('GYRE_AUTH_ALLOW_SIGNUP');
	unsetEnv('GYRE_AUTH_DOMAIN_ALLOWLIST');
	unsetEnv('GYRE_AUDIT_LOG_RETENTION_DAYS');
});

afterEach(() => {
	state.sqlite?.close();
	state.sqlite = null;
	// Restore env vars
	for (const [key, val] of Object.entries(savedEnv)) {
		if (val === undefined) delete process.env[key];
		else process.env[key] = val;
	}
	state.db = null;
	vi.restoreAllMocks();
	vi.resetModules();
});

describe('setSettings', () => {
	test('upserts multiple settings in one transaction', async () => {
		await setSettings([
			{ key: SETTINGS_KEYS.AUTH_ALLOW_SIGNUP, value: 'false' },
			{ key: SETTINGS_KEYS.AUTH_DOMAIN_ALLOWLIST, value: '["example.com"]' }
		]);

		const rows = await state.db!.select().from(schema.appSettings).all();
		expect(rows).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ key: SETTINGS_KEYS.AUTH_ALLOW_SIGNUP, value: 'false' }),
				expect.objectContaining({
					key: SETTINGS_KEYS.AUTH_DOMAIN_ALLOWLIST,
					value: '["example.com"]'
				})
			])
		);
	});

	test('updates existing DB value on a later call', async () => {
		await setSingleSetting('audit.retentionDays', '30');
		await setSingleSetting('audit.retentionDays', '60');

		const row = await state.db!.query.appSettings.findFirst({
			where: eq(schema.appSettings.key, 'audit.retentionDays')
		});
		expect(row?.value).toBe('60');
	});
});

// ---------------------------------------------------------------------------
// getAuditLogRetentionDays
// ---------------------------------------------------------------------------

describe('getAuditLogRetentionDays', () => {
	test('valid integer string parsed correctly', async () => {
		await setSingleSetting(SETTINGS_KEYS.AUDIT_LOG_RETENTION_DAYS, '30');
		const days = await getAuditLogRetentionDays();
		expect(days).toBe(30);
	});

	test('invalid string returns 90 default', async () => {
		await setSingleSetting(SETTINGS_KEYS.AUDIT_LOG_RETENTION_DAYS, 'abc');
		const days = await getAuditLogRetentionDays();
		expect(days).toBe(90);
	});

	test('zero returns 90 default', async () => {
		await setSingleSetting(SETTINGS_KEYS.AUDIT_LOG_RETENTION_DAYS, '0');
		const days = await getAuditLogRetentionDays();
		expect(days).toBe(90);
	});

	test('negative value returns 90 default', async () => {
		await setSingleSetting(SETTINGS_KEYS.AUDIT_LOG_RETENTION_DAYS, '-5');
		const days = await getAuditLogRetentionDays();
		expect(days).toBe(90);
	});
});

// ---------------------------------------------------------------------------
// isSettingOverriddenByEnv
// ---------------------------------------------------------------------------

describe('isSettingOverriddenByEnv', () => {
	test('returns true when env var is set', () => {
		setEnv('GYRE_AUTH_LOCAL_LOGIN_ENABLED', 'true');
		expect(isSettingOverriddenByEnv(SETTINGS_KEYS.AUTH_LOCAL_LOGIN_ENABLED)).toBe(true);
	});

	test('returns false when env var is not set', () => {
		// Ensure it's unset (beforeEach already does this, but be explicit)
		unsetEnv('GYRE_AUTH_LOCAL_LOGIN_ENABLED');
		expect(isSettingOverriddenByEnv(SETTINGS_KEYS.AUTH_LOCAL_LOGIN_ENABLED)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// getAuthSettings
// ---------------------------------------------------------------------------

describe('getAuthSettings', () => {
	test('returns typed object with correct fields', async () => {
		await setSettings([
			{ key: SETTINGS_KEYS.AUTH_LOCAL_LOGIN_ENABLED, value: 'true' },
			{ key: SETTINGS_KEYS.AUTH_ALLOW_SIGNUP, value: 'false' },
			{ key: SETTINGS_KEYS.AUTH_DOMAIN_ALLOWLIST, value: '["example.com","corp.io"]' }
		]);

		const settings = await getAuthSettings();

		expect(settings.localLoginEnabled).toBe(true);
		expect(settings.allowSignup).toBe(false);
		expect(settings.domainAllowlist).toEqual(['example.com', 'corp.io']);
	});

	test('returns defaults when no DB values set', async () => {
		const settings = await getAuthSettings();

		expect(settings.localLoginEnabled).toBe(true);
		expect(settings.allowSignup).toBe(true);
		expect(settings.domainAllowlist).toEqual([]);
	});

	test('defaults allowSignup to false in production when unset', async () => {
		const previousNodeEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = 'production';

		try {
			unsetEnv('GYRE_AUTH_ALLOW_SIGNUP');
			const settings = await getAuthSettings();
			expect(settings.allowSignup).toBe(false);
		} finally {
			if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
			else process.env.NODE_ENV = previousNodeEnv;
		}
	});
});

// ---------------------------------------------------------------------------
// seedAuthSettings
// ---------------------------------------------------------------------------

describe('seedAuthSettings', () => {
	test('seeds defaults into DB on first call', async () => {
		await seedAuthSettings();

		const row = await state.db!.query.appSettings.findFirst({
			where: eq(schema.appSettings.key, SETTINGS_KEYS.AUTH_LOCAL_LOGIN_ENABLED)
		});
		expect(row?.value).toBe('true');
	});

	test('does not overwrite existing DB values on second call', async () => {
		// Set a custom value first
		await setSingleSetting(SETTINGS_KEYS.AUTH_LOCAL_LOGIN_ENABLED, 'false');

		// Seed again — should not overwrite
		await seedAuthSettings();

		const row = await state.db!.query.appSettings.findFirst({
			where: eq(schema.appSettings.key, SETTINGS_KEYS.AUTH_LOCAL_LOGIN_ENABLED)
		});
		expect(row?.value).toBe('false');
	});

	test('seeds production-safe signup default when no env override is set', async () => {
		const previousNodeEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = 'production';

		try {
			await seedAuthSettings();

			const row = await state.db!.query.appSettings.findFirst({
				where: eq(schema.appSettings.key, SETTINGS_KEYS.AUTH_ALLOW_SIGNUP)
			});
			expect(row?.value).toBe('false');
		} finally {
			if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
			else process.env.NODE_ENV = previousNodeEnv;
		}
	});
});
