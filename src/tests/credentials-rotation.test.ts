import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { importFresh } from './helpers/import-fresh';
import * as schema from '../lib/server/db/schema.js';

type CredentialsModule = typeof import('../lib/server/auth/credentials.js');

const CREATE_SCHEMA = `
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
);
CREATE TABLE accounts (
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
	UNIQUE(provider_id, account_id)
);
CREATE TABLE password_history (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	password_hash TEXT NOT NULL,
	created_at_ms INTEGER NOT NULL,
	created_at INTEGER NOT NULL DEFAULT (unixepoch()),
	UNIQUE(user_id, password_hash)
)`;

let sqlite: Database.Database;
let db: ReturnType<typeof drizzle<typeof schema>>;
let updateUserPassword: CredentialsModule['updateUserPassword'];
let getCredentialPasswordHash: CredentialsModule['getCredentialPasswordHash'];
let hasManagedPassword: CredentialsModule['hasManagedPassword'];
let idSequence = 0;

beforeEach(async () => {
	vi.resetModules();
	idSequence = 0;
	sqlite = new Database(':memory:');
	sqlite.exec(CREATE_SCHEMA);
	db = drizzle(sqlite, { schema });

	vi.doMock('../lib/server/db/index.js', () => ({
		getDb: async () => db,
		getDbSync: () => db,
		schema
	}));
	vi.doMock('../lib/server/auth/in-cluster-admin.js', () => ({
		isInClusterMode: () => false,
		validateInClusterAdmin: vi.fn()
	}));
	vi.doMock('../lib/server/auth/passwords.js', () => ({
		generateUserId: () => `generated-${++idSequence}`,
		hashPassword: async (password: string) => `hash:${password}`,
		normalizeUsername: (username: string) => username.toLowerCase().trim(),
		verifyPassword: vi.fn()
	}));
	vi.doMock('bcryptjs', () => ({
		default: {
			hash: async () => 'dummy-hash',
			compare: async () => false
		},
		hash: async () => 'dummy-hash',
		compare: async () => false
	}));

	const credentials = await importFresh<CredentialsModule>('../lib/server/auth/credentials.js');
	updateUserPassword = credentials.updateUserPassword;
	getCredentialPasswordHash = credentials.getCredentialPasswordHash;
	hasManagedPassword = credentials.hasManagedPassword;

	db.insert(schema.users)
		.values({
			id: 'user-1',
			username: 'alice',
			name: 'alice',
			email: 'alice@example.com',
			role: 'viewer',
			active: true,
			isLocal: true,
			requiresPasswordChange: false,
			emailVerified: false
		})
		.run();
});

afterEach(() => {
	sqlite.close();
	vi.restoreAllMocks();
	vi.resetModules();
});

describe('credential password management', () => {
	test('reads credential hashes and identifies managed-password users', async () => {
		db.insert(schema.accounts)
			.values({
				id: 'account-1',
				providerId: 'credential',
				accountId: 'user-1',
				userId: 'user-1',
				password: 'old-hash'
			})
			.run();

		expect(await getCredentialPasswordHash('user-1')).toBe('old-hash');
		expect(await hasManagedPassword('user-1')).toBe(true);
		expect(await getCredentialPasswordHash('missing-user')).toBeNull();
	});

	test('archives an existing hash while rotating the credential account', async () => {
		db.insert(schema.accounts)
			.values({
				id: 'account-1',
				providerId: 'credential',
				accountId: 'user-1',
				userId: 'user-1',
				password: 'old-hash'
			})
			.run();

		await updateUserPassword('user-1', 'new-password');

		expect(await getCredentialPasswordHash('user-1')).toBe('hash:new-password');
		expect(db.select().from(schema.passwordHistory).all()).toEqual([
			expect.objectContaining({ userId: 'user-1', passwordHash: 'old-hash' })
		]);
	});

	test('creates a credential account when a local user has none', async () => {
		await updateUserPassword('user-1', 'first-password');

		expect(await getCredentialPasswordHash('user-1')).toBe('hash:first-password');
		expect(db.select().from(schema.passwordHistory).all()).toHaveLength(0);
	});

	test('rejects password updates for missing users', async () => {
		await expect(updateUserPassword('missing-user', 'new-password')).rejects.toThrow(
			'User not found'
		);
	});
});
