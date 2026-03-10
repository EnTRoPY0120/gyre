import { describe, test, expect, beforeEach, mock, spyOn } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '../lib/server/db/schema.js';
import { auditLogs } from '../lib/server/db/schema.js';

// Mutable reference shared with the mock closure so each test gets a fresh DB
const state: {
	db: ReturnType<typeof drizzle<typeof schema>> | null;
	retentionDays: number;
} = {
	db: null,
	retentionDays: 90
};

// Mock the database module
mock.module('../lib/server/db/index.js', () => ({
	getDb: async () => state.db,
	getDbSync: () => state.db,
	schema
}));

// Mock the settings module
mock.module('../lib/server/settings.js', () => ({
	getAuditLogRetentionDays: async () => state.retentionDays,
	getSetting: async (_key: string) => String(state.retentionDays),
	SETTINGS_KEYS: {
		AUDIT_LOG_RETENTION_DAYS: 'audit.retentionDays'
	}
}));

import {
	cleanupOldAuditLogs,
	scheduleAuditLogCleanup,
	stopAuditLogCleanup
} from '../lib/server/audit.js';
import { getCutoffDate, getRandomJitterMs, MS_PER_DAY } from '../lib/server/utils/time.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CREATE_USERS_TABLE = `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		username TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL,
		email TEXT,
		role TEXT NOT NULL DEFAULT 'viewer',
		active INTEGER NOT NULL DEFAULT 1,
		is_local INTEGER NOT NULL DEFAULT 1,
		created_at INTEGER NOT NULL DEFAULT (unixepoch()),
		updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
		preferences TEXT
	)
`;

const CREATE_AUDIT_LOGS_TABLE = `
	CREATE TABLE IF NOT EXISTS audit_logs (
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
	)
`;

function setupInMemoryDb() {
	const sqlite = new Database(':memory:');
	sqlite.exec(CREATE_USERS_TABLE);
	sqlite.exec(CREATE_AUDIT_LOGS_TABLE);
	return drizzle(sqlite, { schema });
}

type TestDb = ReturnType<typeof setupInMemoryDb>;

function insertAuditLog(db: TestDb, id: string, createdAt: Date) {
	db.insert(auditLogs)
		.values({
			id,
			action: 'test-action',
			createdAt
		})
		.run();
	return id;
}

function daysAgo(days: number) {
	return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// cleanupOldAuditLogs
// ---------------------------------------------------------------------------

describe('cleanupOldAuditLogs', () => {
	beforeEach(() => {
		state.db = setupInMemoryDb();
		state.retentionDays = 90;
	});

	test('resolves without error when audit_logs table is empty', async () => {
		const deletedCount = await cleanupOldAuditLogs();
		expect(deletedCount).toBe(0);
	});

	test('deletes a single old audit log', async () => {
		const db = state.db!;
		const oldId = insertAuditLog(db, 'old-log', daysAgo(91));
		const newId = insertAuditLog(db, 'new-log', daysAgo(10));

		const deletedCount = await cleanupOldAuditLogs();
		expect(deletedCount).toBe(1);

		const remaining = db.select().from(auditLogs).all();
		const ids = remaining.map((l) => l.id);
		expect(ids).not.toContain(oldId);
		expect(ids).toContain(newId);
	});

	test('keeps logs within retention period', async () => {
		const db = state.db!;
		const logId = insertAuditLog(db, 'recent-log', daysAgo(89));

		const deletedCount = await cleanupOldAuditLogs();
		expect(deletedCount).toBe(0);

		const remaining = db.select().from(auditLogs).all();
		expect(remaining.some((l) => l.id === logId)).toBe(true);
	});

	test('respects custom retention period', async () => {
		const db = state.db!;
		state.retentionDays = 30;

		const log31 = insertAuditLog(db, 'log-31', daysAgo(31));
		const log29 = insertAuditLog(db, 'log-29', daysAgo(29));

		const deletedCount = await cleanupOldAuditLogs();
		expect(deletedCount).toBe(1);

		const remaining = db.select().from(auditLogs).all();
		const ids = remaining.map((l) => l.id);
		expect(ids).not.toContain(log31);
		expect(ids).toContain(log29);
	});

	test('deletes multiple old logs', async () => {
		const db = state.db!;
		insertAuditLog(db, 'old-1', daysAgo(100));
		insertAuditLog(db, 'old-2', daysAgo(120));
		insertAuditLog(db, 'new-1', daysAgo(50));

		const deletedCount = await cleanupOldAuditLogs();
		expect(deletedCount).toBe(2);

		const remaining = db.select().from(auditLogs).all();
		expect(remaining).toHaveLength(1);
		expect(remaining[0].id).toBe('new-1');
	});

	test('handles errors gracefully', async () => {
		// Cause getAuditLogRetentionDays to return NaN
		state.retentionDays = NaN;

		const deletedCount = await cleanupOldAuditLogs();
		// Should return 0 and not throw
		expect(deletedCount).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Scheduler Tests
// ---------------------------------------------------------------------------

describe('Audit Log Scheduler', () => {
	beforeEach(() => {
		stopAuditLogCleanup();
	});

	test('scheduleAuditLogCleanup sets up timeouts', () => {
		const setTimeoutSpy = spyOn(global, 'setTimeout');

		scheduleAuditLogCleanup();

		// Should have set up initialDelayTimeout and immediateCleanupTimeout
		expect(setTimeoutSpy).toHaveBeenCalled();

		setTimeoutSpy.mockRestore();
	});

	test('stopAuditLogCleanup clears timeouts', () => {
		const clearTimeoutSpy = spyOn(global, 'clearTimeout');
		const clearIntervalSpy = spyOn(global, 'clearInterval');

		scheduleAuditLogCleanup();
		stopAuditLogCleanup();

		expect(clearTimeoutSpy).toHaveBeenCalled();
		// clearInterval might not be called if the interval wasn't created yet (it's created inside the timeout)

		clearTimeoutSpy.mockRestore();
		clearIntervalSpy.mockRestore();
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
