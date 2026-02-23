import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '../lib/server/db/schema.js';
import { users } from '../lib/server/db/schema.js';

// Mutable reference shared with the mock closure so each test gets a fresh DB
const state: { db: ReturnType<typeof drizzle<typeof schema>> | null } = { db: null };

// Bun hoists mock.module calls above static imports, so auth.ts will receive
// this mock when it imports getDb / getDbSync.
mock.module('../lib/server/db/index.js', () => ({
	getDb: async () => state.db,
	getDbSync: () => state.db,
	schema
}));

mock.module('../lib/server/rbac-defaults.js', () => ({
	bindUserToDefaultPolicies: async () => {},
	syncUserPolicyBindings: async () => {}
}));

mock.module('bcryptjs', () => ({
	hash: async () => 'hashed_password',
	compare: async () => true
}));

import { listUsersPaginated, createUser } from '../lib/server/auth.js';

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

function setupInMemoryDb() {
	const sqlite = new Database(':memory:');
	sqlite.exec(CREATE_USERS_TABLE);
	return drizzle(sqlite, { schema });
}

describe('Pagination Logic', () => {
	let prefix: string;

	beforeEach(async () => {
		state.db = setupInMemoryDb();

		// Create some test users
		prefix = `pagetest_${Date.now()}`;
		// We insert directly using helper or createUser function?
		// createUser uses getDb(), which is mocked to return state.db.
		// So we can use createUser.

		for (let i = 0; i < 15; i++) {
			try {
				await createUser(`${prefix}_${i}`, 'password123', 'viewer', `${prefix}_${i}@example.com`);
			} catch (e) {
				console.error('Failed to create test user', e);
			}
		}
	});

	test('listUsersPaginated returns correct page size', async () => {
		const result = await listUsersPaginated({ limit: 5 });
		expect(result.users.length).toBe(5);
		expect(result.total).toBeGreaterThanOrEqual(15);
	});

	test('listUsersPaginated handles offset', async () => {
		const page1 = await listUsersPaginated({ limit: 5, offset: 0 });
		const page2 = await listUsersPaginated({ limit: 5, offset: 5 });

		expect(page1.users.length).toBe(5);
		expect(page2.users.length).toBe(5);

		expect(page1.users[0]).toBeDefined();
		expect(page2.users[0]).toBeDefined();

		// Basic check that we are getting different users
		// Since we are creating them in a loop, IDs should be different.
		// We can check IDs.
		const ids1 = page1.users.map((u) => u.id);
		const ids2 = page2.users.map((u) => u.id);

		// Ensure no intersection
		for (const id of ids1) {
			expect(ids2).not.toContain(id);
		}
	});

	test('listUsersPaginated handles search', async () => {
		const result = await listUsersPaginated({ search: prefix });
		expect(result.total).toBeGreaterThanOrEqual(15);
		expect(result.users.length).toBeGreaterThan(0);

		// Verify we only got our test users
		for (const user of result.users) {
			expect(user.username).toContain(prefix);
		}
	});
});
