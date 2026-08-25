import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { importFresh } from './helpers/import-fresh';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../lib/server/db/schema.js';
import { appSettings, auditLogs } from '../lib/server/db/schema.js';

vi.spyOn(console, 'log').mockImplementation(() => {});

type AuditModule = typeof import('../lib/server/audit.js');
let cleanupOldAuditLogs: AuditModule['cleanupOldAuditLogs'];
let scheduleAuditLogCleanup: AuditModule['scheduleAuditLogCleanup'];
const state: {
	db: ReturnType<typeof drizzle<typeof schema>> | null;
} = { db: null };
import { getCutoffDate, getRandomJitterMs, MS_PER_DAY } from '../lib/server/utils/time.js';

const CREATE_AUDIT_LOGS_TABLE = `
	CREATE TABLE audit_logs (
		id TEXT PRIMARY KEY,
		user_id TEXT,
		action TEXT NOT NULL,
		resource_type TEXT,
		resource_name TEXT,
		namespace TEXT,
		cluster_id TEXT,
		details TEXT,
		success INTEGER NOT NULL DEFAULT 1,
		ip_address TEXT,
		created_at INTEGER NOT NULL DEFAULT (unixepoch())
	)`;

const CREATE_APP_SETTINGS_TABLE = `
	CREATE TABLE app_settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL,
		updated_at INTEGER NOT NULL DEFAULT (unixepoch())
	)`;

function createTestDb() {
	const sqlite = new Database(':memory:');
	sqlite.exec(CREATE_AUDIT_LOGS_TABLE);
	sqlite.exec(CREATE_APP_SETTINGS_TABLE);
	return drizzle(sqlite, { schema });
}

function daysAgo(days: number): Date {
	return new Date(Date.now() - days * MS_PER_DAY);
}

function setRetentionDays(value: string): void {
	state.db
		?.insert(appSettings)
		.values({ key: 'audit.retentionDays', value, updatedAt: new Date() })
		.onConflictDoUpdate({
			target: appSettings.key,
			set: { value, updatedAt: new Date() }
		})
		.run();
}

function insertAuditLog(id: string, createdAt: Date): void {
	state.db?.insert(auditLogs).values({ id, action: 'test-action', createdAt }).run();
}

beforeEach(async () => {
	vi.doMock('../lib/server/db/index.js', () => ({
		getDb: async () => state.db,
		getDbSync: () => state.db,
		schema
	}));
	const auditModule = await importFresh<AuditModule>('../lib/server/audit.js');
	cleanupOldAuditLogs = auditModule.cleanupOldAuditLogs;
	scheduleAuditLogCleanup = auditModule.scheduleAuditLogCleanup;
});

afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.resetModules();
	state.db = null;
});

describe('cleanupOldAuditLogs', () => {
	beforeEach(() => {
		state.db = createTestDb();
		setRetentionDays('90');
	});

	test('deletes expired logs while retaining recent logs', async () => {
		insertAuditLog('old-log', daysAgo(91));
		insertAuditLog('recent-log', daysAgo(10));

		expect(await cleanupOldAuditLogs()).toBe(1);
		expect(
			state.db
				?.select()
				.from(auditLogs)
				.all()
				.map(({ id }) => id)
		).toEqual(['recent-log']);
	});

	test('honors a custom retention period', async () => {
		setRetentionDays('30');
		insertAuditLog('expired-log', daysAgo(31));
		insertAuditLog('retained-log', daysAgo(29));

		expect(await cleanupOldAuditLogs()).toBe(1);
		expect(
			state.db
				?.select()
				.from(auditLogs)
				.all()
				.map(({ id }) => id)
		).toEqual(['retained-log']);
	});

	test('uses the default retention period for invalid settings', async () => {
		setRetentionDays('invalid');
		insertAuditLog('expired-log', daysAgo(91));

		expect(await cleanupOldAuditLogs()).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// Scheduler Tests
// ---------------------------------------------------------------------------

describe('Audit Log Scheduler', () => {
	test('scheduleAuditLogCleanup sets up timeouts', () => {
		vi.useFakeTimers();
		const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

		scheduleAuditLogCleanup();

		// Should have set up initialDelayTimeout and immediateCleanupTimeout
		expect(setTimeoutSpy).toHaveBeenCalled();

		setTimeoutSpy.mockRestore();
	});

	test('scheduleAuditLogCleanup is idempotent', () => {
		vi.useFakeTimers();
		const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

		scheduleAuditLogCleanup();
		scheduleAuditLogCleanup();

		expect(setTimeoutSpy).toHaveBeenCalledTimes(2);

		setTimeoutSpy.mockRestore();
	});
});

// ---------------------------------------------------------------------------
// Time Utilities Tests
// ---------------------------------------------------------------------------

describe('Time Utilities', () => {
	test('getCutoffDate returns a date in the past', () => {
		const retentionDays = 30;
		const cutoff = getCutoffDate(retentionDays);
		const now = new Date();

		// Should be approximately retentionDays ago
		const diffMs = now.getTime() - cutoff.getTime();
		const diffDays = diffMs / MS_PER_DAY;

		expect(diffDays).toBeGreaterThanOrEqual(29.9);
		expect(diffDays).toBeLessThanOrEqual(30.1);
	});

	test('getRandomJitterMs returns value within range', () => {
		const maxMinutes = 30;
		const jitter = getRandomJitterMs(maxMinutes);

		expect(jitter).toBeGreaterThanOrEqual(0);
		expect(jitter).toBeLessThanOrEqual(maxMinutes * 60 * 1000);
	});
});
