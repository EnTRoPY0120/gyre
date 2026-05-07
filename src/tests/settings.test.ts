import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { importFresh } from './helpers/import-fresh';

spyOn(console, 'log').mockImplementation(() => {});

import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '../lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

// Mutable reference shared with the mock closure so each test gets a fresh DB
const state: { db: ReturnType<typeof drizzle<typeof schema>> | null } = { db: null };
type SettingsModule = typeof import('../lib/server/settings.js');
let getSetting: SettingsModule['getSetting'];
let setSetting: SettingsModule['setSetting'];
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
	sqlite.exec(CREATE_APP_SETTINGS);
	return drizzle(sqlite, { schema });
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
	state.db = setupInMemoryDb();
	savedEnv = {};
	mock.module('../lib/server/db/index.js', () => ({
		getDb: async () => state.db,
		getDbSync: () => state.db,
		schema
	}));
	const settingsModule = await importFresh<SettingsModule>('../lib/server/settings.js?sut');
	getSetting = settingsModule.getSetting;
	setSetting = settingsModule.setSetting;
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
	// Restore env vars
	for (const [key, val] of Object.entries(savedEnv)) {
		if (val === undefined) delete process.env[key];
		else process.env[key] = val;
	}
	state.db = null;
	mock.restore();
});

// ---------------------------------------------------------------------------
// getSetting
// ---------------------------------------------------------------------------

describe('getSetting', () => {
	test('env override takes precedence over DB value', async () => {
		// Insert a different value in DB
		await setSetting(SETTINGS_KEYS.AUTH_LOCAL_LOGIN_ENABLED, 'false');
		// Set env var to override
		setEnv('GYRE_AUTH_LOCAL_LOGIN_ENABLED', 'true');

		const value = await getSetting(SETTINGS_KEYS.AUTH_LOCAL_LOGIN_ENABLED);
		expect(value).toBe('true'); // env var wins
	});

	test('direct DB updates are visible on the next read in the same process', async () => {
		const key = SETTINGS_KEYS.AUTH_ALLOW_SIGNUP;

		await state
			.db!.insert(schema.appSettings)
			.values({ key, value: 'cached-value', updatedAt: new Date() })
			.onConflictDoNothing();

		const val1 = await getSetting(key);
		expect(val1).toBe('cached-value');

		await state
			.db!.update(schema.appSettings)
			.set({ value: 'new-db-value', updatedAt: new Date() })
			.where(eq(schema.appSettings.key, key));

		const val2 = await getSetting(key);
		expect(val2).toBe('new-db-value');
	});

	test('DB miss falls back to DEFAULTS map', async () => {
		// Key is not in the DB — should return the default value
		const value = await getSetting(SETTINGS_KEYS.AUDIT_LOG_RETENTION_DAYS);
		expect(value).toBe('90');
	});
});

// ---------------------------------------------------------------------------
// setSetting
// ---------------------------------------------------------------------------

describe('setSetting', () => {
	test('upserts to DB on first call', async () => {
		await setSetting('audit.retentionDays', '30');

		const row = await state.db!.query.appSettings.findFirst({
			where: eq(schema.appSettings.key, 'audit.retentionDays')
		});
		expect(row?.value).toBe('30');
	});

	test('updates existing DB value on second call', async () => {
		await setSetting('audit.retentionDays', '30');
		await setSetting('audit.retentionDays', '60');

		const row = await state.db!.query.appSettings.findFirst({
			where: eq(schema.appSettings.key, 'audit.retentionDays')
		});
		expect(row?.value).toBe('60');
	});

	test('subsequent getSetting reads updated values after setSetting', async () => {
		const key = SETTINGS_KEYS.AUTH_LOCAL_LOGIN_ENABLED;

		await setSetting(key, 'true');
		const val1 = await getSetting(key);
		expect(val1).toBe('true');

		await setSetting(key, 'false');

		const val2 = await getSetting(key);
		expect(val2).toBe('false');
	});
});

describe('setSettings', () => {
	test('upserts multiple settings in one transaction', async () => {
		await setSettings([
			{ key: SETTINGS_KEYS.AUTH_ALLOW_SIGNUP, value: 'false' },
			{ key: SETTINGS_KEYS.AUTH_DOMAIN_ALLOWLIST, value: '["example.com"]' }
		]);

		expect(await getSetting(SETTINGS_KEYS.AUTH_ALLOW_SIGNUP)).toBe('false');
		expect(await getSetting(SETTINGS_KEYS.AUTH_DOMAIN_ALLOWLIST)).toBe('["example.com"]');
	});
});

// ---------------------------------------------------------------------------
// getAuditLogRetentionDays
// ---------------------------------------------------------------------------

describe('getAuditLogRetentionDays', () => {
	test('valid integer string parsed correctly', async () => {
		await setSetting(SETTINGS_KEYS.AUDIT_LOG_RETENTION_DAYS, '30');
		const days = await getAuditLogRetentionDays();
		expect(days).toBe(30);
	});

	test('invalid string returns 90 default', async () => {
		await setSetting(SETTINGS_KEYS.AUDIT_LOG_RETENTION_DAYS, 'abc');
		const days = await getAuditLogRetentionDays();
		expect(days).toBe(90);
	});

	test('zero returns 90 default', async () => {
		await setSetting(SETTINGS_KEYS.AUDIT_LOG_RETENTION_DAYS, '0');
		const days = await getAuditLogRetentionDays();
		expect(days).toBe(90);
	});

	test('negative value returns 90 default', async () => {
		await setSetting(SETTINGS_KEYS.AUDIT_LOG_RETENTION_DAYS, '-5');
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
		await setSetting(SETTINGS_KEYS.AUTH_LOCAL_LOGIN_ENABLED, 'true');
		await setSetting(SETTINGS_KEYS.AUTH_ALLOW_SIGNUP, 'false');
		await setSetting(SETTINGS_KEYS.AUTH_DOMAIN_ALLOWLIST, '["example.com","corp.io"]');

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
		await setSetting(SETTINGS_KEYS.AUTH_LOCAL_LOGIN_ENABLED, 'false');

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
