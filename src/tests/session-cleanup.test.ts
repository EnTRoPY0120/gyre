import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq } from 'drizzle-orm';
import * as schema from '../lib/server/db/schema.js';
import { sessions, users } from '../lib/server/db/schema.js';

// Mutable reference shared with the mock closure so each test gets a fresh DB
const state: { db: ReturnType<typeof drizzle<typeof schema>> | null } = { db: null };

// Bun hoists mock.module calls above static imports, so auth.ts will receive
// this mock when it imports getDb / getDbSync.
mock.module('../lib/server/db/index.js', () => ({
	getDb: async () => state.db,
	getDbSync: () => state.db,
	schema
}));

import {
	cleanupExpiredSessions,
	createSession,
	getSession,
	deleteSession,
	deleteUserSessions,
	generateSessionId,
	generateUserId
} from '../lib/server/auth.js';

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

const CREATE_SESSIONS_TABLE = `
	CREATE TABLE IF NOT EXISTS sessions (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		expires_at INTEGER NOT NULL,
		ip_address TEXT,
		user_agent TEXT,
		created_at INTEGER NOT NULL DEFAULT (unixepoch())
	)
`;

function setupInMemoryDb() {
	const sqlite = new Database(':memory:');
	sqlite.exec(CREATE_USERS_TABLE);
	sqlite.exec(CREATE_SESSIONS_TABLE);
	return drizzle(sqlite, { schema });
}

type TestDb = ReturnType<typeof setupInMemoryDb>;

async function insertUser(db: TestDb, overrides: Partial<typeof users.$inferInsert> = {}) {
	const id = overrides.id ?? generateUserId();
	db.insert(users)
		.values({
			id,
			username: overrides.username ?? `user_${id.slice(0, 8)}`,
			passwordHash: 'hashed',
			role: 'viewer',
			active: true,
			...overrides
		})
		.run();
	return id;
}

function insertSession(db: TestDb, userId: string, expiresAt: Date, id = generateSessionId()) {
	db.insert(sessions).values({ id, userId, expiresAt }).run();
	return id;
}

function daysFromNow(days: number) {
	return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// cleanupExpiredSessions
// ---------------------------------------------------------------------------

describe('cleanupExpiredSessions', () => {
	beforeEach(() => {
		state.db = setupInMemoryDb();
	});

	test('resolves without error when sessions table is empty', async () => {
		await expect(cleanupExpiredSessions()).resolves.toBeUndefined();
	});

	test('deletes a single expired session', async () => {
		const db = state.db!;
		const userId = await insertUser(db);
		const expiredId = insertSession(db, userId, new Date(Date.now() - 1000));

		await cleanupExpiredSessions();

		const remaining = db.select().from(sessions).all();
		expect(remaining.some((s) => s.id === expiredId)).toBe(false);
	});

	test('keeps a session that has not yet expired', async () => {
		const db = state.db!;
		const userId = await insertUser(db);
		const validId = insertSession(db, userId, daysFromNow(7));

		await cleanupExpiredSessions();

		const remaining = db.select().from(sessions).all();
		expect(remaining.some((s) => s.id === validId)).toBe(true);
	});

	test('deletes only expired sessions when mixed with valid ones', async () => {
		const db = state.db!;
		const userId = await insertUser(db);

		const expiredId = insertSession(db, userId, new Date(Date.now() - 1000));
		const validId = insertSession(db, userId, daysFromNow(7));

		await cleanupExpiredSessions();

		const remaining = db.select().from(sessions).all();
		const ids = remaining.map((s) => s.id);
		expect(ids).not.toContain(expiredId);
		expect(ids).toContain(validId);
	});

	test('deletes multiple expired sessions in one call', async () => {
		const db = state.db!;
		const userId = await insertUser(db);
		const past = new Date(Date.now() - 1000);

		const id1 = insertSession(db, userId, past);
		const id2 = insertSession(db, userId, past);
		const id3 = insertSession(db, userId, past);

		await cleanupExpiredSessions();

		const remaining = db.select().from(sessions).all();
		expect(remaining).toHaveLength(0);
		expect(remaining.some((s) => s.id === id1 || s.id === id2 || s.id === id3)).toBe(false);
	});

	test('cleans up expired sessions across multiple users', async () => {
		const db = state.db!;
		const userId1 = await insertUser(db);
		const userId2 = await insertUser(db);
		const past = new Date(Date.now() - 1000);

		const expiredA = insertSession(db, userId1, past);
		const expiredB = insertSession(db, userId2, past);
		const validC = insertSession(db, userId1, daysFromNow(7));
		const validD = insertSession(db, userId2, daysFromNow(3));

		await cleanupExpiredSessions();

		const remaining = db.select().from(sessions).all();
		const ids = remaining.map((s) => s.id);
		expect(ids).not.toContain(expiredA);
		expect(ids).not.toContain(expiredB);
		expect(ids).toContain(validC);
		expect(ids).toContain(validD);
	});

	test('a session expiring well in the future is not deleted', async () => {
		const db = state.db!;
		const userId = await insertUser(db);
		const sessionId = insertSession(db, userId, daysFromNow(30));

		await cleanupExpiredSessions();

		const remaining = db.select().from(sessions).all();
		expect(remaining.some((s) => s.id === sessionId)).toBe(true);
	});

	test('consecutive calls are idempotent', async () => {
		const db = state.db!;
		const userId = await insertUser(db);
		insertSession(db, userId, new Date(Date.now() - 1000));

		await cleanupExpiredSessions();
		await expect(cleanupExpiredSessions()).resolves.toBeUndefined();

		const remaining = db.select().from(sessions).all();
		expect(remaining).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// createSession
// ---------------------------------------------------------------------------

describe('createSession', () => {
	beforeEach(() => {
		state.db = setupInMemoryDb();
	});

	test('returns a 64-character hex session ID', async () => {
		const db = state.db!;
		const userId = await insertUser(db);

		const sessionId = await createSession(userId);
		expect(sessionId).toHaveLength(64);
		expect(sessionId).toMatch(/^[0-9a-f]{64}$/);
	});

	test('inserts a row in the sessions table', async () => {
		const db = state.db!;
		const userId = await insertUser(db);

		const sessionId = await createSession(userId);

		const row = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
		expect(row).toBeDefined();
		expect(row!.userId).toBe(userId);
	});

	test('session expiry is approximately 7 days in the future', async () => {
		const db = state.db!;
		const userId = await insertUser(db);
		const beforeDate = new Date();
		const sessionId = await createSession(userId);
		const afterDate = new Date();

		const row = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
		const expiresMs = row!.expiresAt.getTime();

		// Mirror createSession's setDate(getDate() + 7) to avoid DST skew
		const expectedBefore = new Date(beforeDate);
		expectedBefore.setDate(expectedBefore.getDate() + 7);
		const expectedAfter = new Date(afterDate);
		expectedAfter.setDate(expectedAfter.getDate() + 7);

		expect(expiresMs).toBeGreaterThanOrEqual(expectedBefore.getTime() - 1000);
		expect(expiresMs).toBeLessThanOrEqual(expectedAfter.getTime() + 1000);
	});

	test('stores optional IP address and user agent', async () => {
		const db = state.db!;
		const userId = await insertUser(db);

		const sessionId = await createSession(userId, '192.168.1.1', 'TestAgent/1.0');

		const row = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
		expect(row!.ipAddress).toBe('192.168.1.1');
		expect(row!.userAgent).toBe('TestAgent/1.0');
	});

	test('stores null when IP address and user agent are omitted', async () => {
		const db = state.db!;
		const userId = await insertUser(db);

		const sessionId = await createSession(userId);

		const row = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
		expect(row!.ipAddress).toBeNull();
		expect(row!.userAgent).toBeNull();
	});

	test('each call produces a unique session ID', async () => {
		const db = state.db!;
		const userId = await insertUser(db);

		const ids = new Set<string>();
		for (let i = 0; i < 20; i++) {
			ids.add(await createSession(userId));
		}
		expect(ids.size).toBe(20);
	});
});

// ---------------------------------------------------------------------------
// getSession
// ---------------------------------------------------------------------------

describe('getSession', () => {
	beforeEach(() => {
		state.db = setupInMemoryDb();
	});

	test('returns null for a non-existent session ID', async () => {
		const result = await getSession('non-existent-id');
		expect(result).toBeNull();
	});

	test('returns null for an expired session', async () => {
		const db = state.db!;
		const userId = await insertUser(db);
		const expiredId = insertSession(db, userId, new Date(Date.now() - 1000));

		const result = await getSession(expiredId);
		expect(result).toBeNull();
	});

	test('returns session and user for a valid session', async () => {
		const db = state.db!;
		const userId = await insertUser(db, { username: 'alice', role: 'admin' });
		const sessionId = insertSession(db, userId, daysFromNow(7));

		const result = await getSession(sessionId);
		expect(result).not.toBeNull();
		expect(result!.session.id).toBe(sessionId);
		expect(result!.user.id).toBe(userId);
		expect(result!.user.username).toBe('alice');
	});

	test('returns null when session exists but user does not', async () => {
		const db = state.db!;
		const orphanId = generateSessionId();
		db.insert(sessions)
			.values({
				id: orphanId,
				userId: 'ghost-user-id',
				expiresAt: daysFromNow(7)
			})
			.run();

		const result = await getSession(orphanId);
		expect(result).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// deleteSession
// ---------------------------------------------------------------------------

describe('deleteSession', () => {
	beforeEach(() => {
		state.db = setupInMemoryDb();
	});

	test('removes the specified session from the table', async () => {
		const db = state.db!;
		const userId = await insertUser(db);
		const sessionId = insertSession(db, userId, daysFromNow(7));

		await deleteSession(sessionId);

		const remaining = db.select().from(sessions).all();
		expect(remaining.some((s) => s.id === sessionId)).toBe(false);
	});

	test('does not affect other sessions when deleting one', async () => {
		const db = state.db!;
		const userId = await insertUser(db);
		const toDelete = insertSession(db, userId, daysFromNow(7));
		const toKeep = insertSession(db, userId, daysFromNow(7));

		await deleteSession(toDelete);

		const remaining = db.select().from(sessions).all();
		const ids = remaining.map((s) => s.id);
		expect(ids).not.toContain(toDelete);
		expect(ids).toContain(toKeep);
	});

	test('resolves without error for a non-existent session ID', async () => {
		await expect(deleteSession('non-existent-id')).resolves.toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// deleteUserSessions
// ---------------------------------------------------------------------------

describe('deleteUserSessions', () => {
	beforeEach(() => {
		state.db = setupInMemoryDb();
	});

	test('removes all sessions belonging to the specified user', async () => {
		const db = state.db!;
		const userId = await insertUser(db);
		insertSession(db, userId, daysFromNow(7));
		insertSession(db, userId, daysFromNow(7));

		await deleteUserSessions(userId);

		const remaining = db.select().from(sessions).all();
		expect(remaining.filter((s) => s.userId === userId)).toHaveLength(0);
	});

	test('does not remove sessions belonging to other users', async () => {
		const db = state.db!;
		const targetId = await insertUser(db);
		const otherId = await insertUser(db);
		const otherSessionId = insertSession(db, otherId, daysFromNow(7));
		insertSession(db, targetId, daysFromNow(7));

		await deleteUserSessions(targetId);

		const remaining = db.select().from(sessions).all();
		expect(remaining.some((s) => s.id === otherSessionId)).toBe(true);
	});

	test('resolves without error when the user has no sessions', async () => {
		const db = state.db!;
		const userId = await insertUser(db);
		await expect(deleteUserSessions(userId)).resolves.toBeUndefined();
	});
});
