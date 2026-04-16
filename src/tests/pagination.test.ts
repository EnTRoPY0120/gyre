import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { importFresh } from './helpers/import-fresh';

spyOn(console, 'log').mockImplementation(() => {});
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '../lib/server/db/schema.js';

type AuthModule = typeof import('../lib/server/auth.js');

// Mutable reference shared with the mock closure so each test gets a fresh DB
const state: { db: ReturnType<typeof drizzle<typeof schema>> | null } = { db: null };
let listUsersPaginated: AuthModule['listUsersPaginated'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

const CREATE_ACCOUNTS_TABLE = `
	CREATE TABLE IF NOT EXISTS accounts (
		id TEXT PRIMARY KEY,
		created_at INTEGER NOT NULL DEFAULT (unixepoch()),
		updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
		provider_id TEXT NOT NULL,
		account_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		access_token TEXT,
		refresh_token TEXT,
		id_token TEXT,
		access_token_expires_at INTEGER,
		refresh_token_expires_at INTEGER,
		scope TEXT,
		password TEXT,
		last_login_at INTEGER,
		access_token_encrypted TEXT,
		refresh_token_encrypted TEXT,
		id_token_encrypted TEXT,
		UNIQUE (provider_id, account_id),
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	)
`;

function setupInMemoryDb() {
	const sqlite = new Database(':memory:');
	sqlite.exec(CREATE_USERS_TABLE);
	sqlite.exec(CREATE_ACCOUNTS_TABLE);
	return drizzle(sqlite, { schema });
}

describe('Pagination Logic', () => {
	let prefix: string;

	beforeEach(async () => {
		state.db = setupInMemoryDb();
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
			default: {
				hash: async () => 'hashed_password',
				compare: async () => true
			},
			hash: async () => 'hashed_password',
			compare: async () => true
		}));
		listUsersPaginated = (await importFresh<AuthModule>('../lib/server/auth.js?sut'))
			.listUsersPaginated;

		prefix = `pagetest_${Date.now()}`;
		for (let i = 0; i < 15; i++) {
			const now = new Date();
			state
				.db!.insert(schema.users)
				.values({
					id: `user_${prefix}_${i}`,
					username: `${prefix}_${i}`,
					name: `${prefix}_${i}`,
					email: `${prefix}_${i}@example.com`,
					role: 'viewer',
					active: true,
					isLocal: true,
					requiresPasswordChange: false,
					emailVerified: false,
					createdAt: now,
					updatedAt: now
				})
				.run();
		}
	});

	afterEach(() => {
		state.db = null;
		mock.restore();
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

	test('limit=0 returns empty results but correct total', async () => {
		const result = await listUsersPaginated({ limit: 0 });
		expect(result.users).toHaveLength(0);
		expect(result.total).toBeGreaterThanOrEqual(15);
	});

	test('offset beyond total returns empty results but correct total', async () => {
		const result = await listUsersPaginated({ limit: 10, offset: 10_000 });
		expect(result.users).toHaveLength(0);
		expect(result.total).toBeGreaterThanOrEqual(15);
	});
});

describe('Pagination – empty database', () => {
	beforeEach(() => {
		state.db = setupInMemoryDb();
	});

	test('empty database returns total=0 and empty results', async () => {
		const result = await listUsersPaginated({ limit: 10 });
		expect(result.total).toBe(0);
		expect(result.users).toHaveLength(0);
	});
});
