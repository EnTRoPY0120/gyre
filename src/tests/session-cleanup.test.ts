import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';

spyOn(console, 'log').mockImplementation(() => {});
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '../lib/server/db/schema.js';
import { sessions, users } from '../lib/server/db/schema.js';

const state: { db: ReturnType<typeof drizzle<typeof schema>> | null } = { db: null };

mock.module('../lib/server/db/index.js', () => ({
	getDb: async () => state.db,
	getDbSync: () => state.db,
	schema
}));

const { cleanupExpiredSessions, deleteUserSessions, generateSessionId, generateUserId } =
	(await import('../lib/server/auth.js?test=session-cleanup')) as typeof import('../lib/server/auth.js');

const CREATE_USERS_TABLE = `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		username TEXT NOT NULL UNIQUE,
		email TEXT,
		name TEXT NOT NULL DEFAULT '',
		email_verified INTEGER NOT NULL DEFAULT 0,
		image TEXT,
		role TEXT NOT NULL DEFAULT 'viewer',
		active INTEGER NOT NULL DEFAULT 1,
		is_local INTEGER NOT NULL DEFAULT 1,
		requires_password_change INTEGER NOT NULL DEFAULT 0,
		created_at INTEGER NOT NULL DEFAULT (unixepoch()),
		updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
		preferences TEXT
	)
`;

const CREATE_SESSIONS_TABLE = `
	CREATE TABLE IF NOT EXISTS sessions (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		token TEXT NOT NULL UNIQUE,
		expires_at INTEGER NOT NULL,
		ip_address TEXT,
		user_agent TEXT,
		created_at INTEGER NOT NULL DEFAULT (unixepoch()),
		updated_at INTEGER NOT NULL DEFAULT (unixepoch())
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
			name: overrides.name ?? `user_${id.slice(0, 8)}`,
			role: 'viewer',
			active: true,
			...overrides
		})
		.run();
	return id;
}

function insertSession(db: TestDb, userId: string, expiresAt: Date, id = generateSessionId()) {
	db.insert(sessions)
		.values({
			id,
			userId,
			token: id,
			expiresAt
		})
		.run();
	return id;
}

function daysFromNow(days: number) {
	const now = new Date();
	return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

describe('cleanupExpiredSessions', () => {
	beforeEach(() => {
		state.db = setupInMemoryDb();
	});

	test('resolves without error when sessions table is empty', async () => {
		await expect(cleanupExpiredSessions()).resolves.toBe(0);
	});

	test('deletes only expired sessions when mixed with valid ones', async () => {
		const db = state.db!;
		const userId = await insertUser(db);
		const now = new Date();

		const expiredId = insertSession(db, userId, new Date(now.getTime() - 1000));
		const validId = insertSession(db, userId, daysFromNow(7));

		const deletedCount = await cleanupExpiredSessions();
		expect(deletedCount).toBe(1);

		const remaining = db.select().from(sessions).all();
		const ids = remaining.map((session) => session.id);
		expect(ids).not.toContain(expiredId);
		expect(ids).toContain(validId);
	});

	test('deletes a session that expires exactly now', async () => {
		const db = state.db!;
		const userId = await insertUser(db);
		const now = new Date();
		const spy = spyOn(Date, 'now').mockReturnValue(now.getTime());

		try {
			insertSession(db, userId, now);
			const deletedCount = await cleanupExpiredSessions();
			expect(deletedCount).toBe(1);
			expect(db.select().from(sessions).all()).toHaveLength(0);
		} finally {
			spy.mockRestore();
		}
	});
});

describe('deleteUserSessions', () => {
	beforeEach(() => {
		state.db = setupInMemoryDb();
	});

	test('removes all sessions belonging to the specified user', async () => {
		const db = state.db!;
		const targetUserId = await insertUser(db);
		const otherUserId = await insertUser(db);

		insertSession(db, targetUserId, daysFromNow(7));
		insertSession(db, targetUserId, daysFromNow(3));
		const otherSessionId = insertSession(db, otherUserId, daysFromNow(7));

		await deleteUserSessions(targetUserId);

		const remaining = db.select().from(sessions).all();
		expect(remaining.filter((session) => session.userId === targetUserId)).toHaveLength(0);
		expect(remaining.some((session) => session.id === otherSessionId)).toBe(true);
	});

	test('resolves without error when the user has no sessions', async () => {
		const db = state.db!;
		const userId = await insertUser(db);

		await expect(deleteUserSessions(userId)).resolves.toBeUndefined();
	});
});
