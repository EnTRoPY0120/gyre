import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { importFresh } from './helpers/import-fresh';
import * as schema from '../lib/server/db/schema.js';
import type { User } from '../lib/server/db/schema.js';

type UsersModule = typeof import('../lib/server/auth/users.js');

const CREATE_USERS_TABLE = `
CREATE TABLE users (
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
)`;

let sqlite: Database.Database;
let db: ReturnType<typeof drizzle<typeof schema>>;
let syncUserPolicyBindingsInTx: ReturnType<typeof vi.fn>;
let updateUser: UsersModule['updateUser'];

function createUser(overrides: Partial<User> = {}): User {
	const now = new Date();
	return {
		id: overrides.id ?? 'user-1',
		username: overrides.username ?? 'alice',
		email: overrides.email ?? 'alice@example.com',
		name: overrides.name ?? 'alice',
		emailVerified: overrides.emailVerified ?? false,
		image: overrides.image ?? null,
		role: overrides.role ?? 'viewer',
		active: overrides.active ?? true,
		isLocal: overrides.isLocal ?? true,
		requiresPasswordChange: overrides.requiresPasswordChange ?? false,
		createdAt: overrides.createdAt ?? now,
		updatedAt: overrides.updatedAt ?? now,
		preferences: overrides.preferences ?? null
	};
}

beforeEach(async () => {
	vi.resetModules();
	sqlite = new Database(':memory:');
	sqlite.exec(CREATE_USERS_TABLE);
	db = drizzle(sqlite, { schema });
	syncUserPolicyBindingsInTx = vi.fn();

	vi.doMock('../lib/server/db/index.js', () => ({
		getDb: async () => db,
		getDbSync: () => db,
		schema
	}));
	vi.doMock('../lib/server/rbac-defaults.js', () => ({
		bindUserToDefaultPoliciesInTx: vi.fn(),
		syncUserPolicyBindingsInTx
	}));

	const user = createUser();
	db.insert(schema.users).values(user).run();
	updateUser = (await importFresh<UsersModule>('../lib/server/auth/users.js')).updateUser;
});

afterEach(() => {
	sqlite.close();
	vi.restoreAllMocks();
	vi.resetModules();
});

describe('updateUser', () => {
	test('updates user fields and synchronizes bindings when the role changes', async () => {
		const updated = await updateUser('user-1', { role: 'admin', active: false });

		expect(updated).toMatchObject({ id: 'user-1', role: 'admin', active: false });
		expect(syncUserPolicyBindingsInTx).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ id: 'user-1', role: 'admin' })
		);
	});

	test('updates non-role fields without synchronizing unchanged role bindings', async () => {
		const updated = await updateUser('user-1', { email: 'new@example.com' });

		expect(updated).toMatchObject({ email: 'new@example.com', role: 'viewer' });
		expect(syncUserPolicyBindingsInTx).not.toHaveBeenCalled();
	});

	test('returns null when the target user does not exist', async () => {
		expect(await updateUser('missing-user', { role: 'admin' })).toBeNull();
		expect(syncUserPolicyBindingsInTx).not.toHaveBeenCalled();
	});
});
