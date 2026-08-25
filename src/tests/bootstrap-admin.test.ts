import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { importFresh } from './helpers/import-fresh';
import * as schema from '../lib/server/db/schema.js';

type BootstrapAdminModule = typeof import('../lib/server/auth/bootstrap-admin.js');

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
)`;

let sqlite: Database.Database;
let db: ReturnType<typeof drizzle<typeof schema>>;
let createDefaultAdminIfNeeded: BootstrapAdminModule['createDefaultAdminIfNeeded'];
let errorLog: ReturnType<typeof vi.fn>;
let idSequence = 0;
let originalAdminPassword: string | undefined;

beforeEach(async () => {
	vi.resetModules();
	idSequence = 0;
	originalAdminPassword = process.env.ADMIN_PASSWORD;
	delete process.env.ADMIN_PASSWORD;
	sqlite = new Database(':memory:');
	sqlite.exec(CREATE_SCHEMA);
	db = drizzle(sqlite, { schema });
	errorLog = vi.fn();

	vi.doMock('../lib/server/db/index.js', () => ({
		getDb: async () => db,
		getDbSync: () => db,
		schema
	}));
	vi.doMock('../lib/server/auth/in-cluster-admin.js', () => ({
		isInClusterMode: () => false,
		loadOrCreateInClusterAdmin: vi.fn()
	}));
	vi.doMock('../lib/server/auth/passwords.js', () => ({
		generateStrongPassword: () => 'Generated-strong-password1!',
		generateUserId: () => `generated-${++idSequence}`,
		hashPassword: async (password: string) => `hash:${password}`,
		normalizeUsername: (username: string) => username.toLowerCase().trim(),
		validateAdminPasswordStrength: vi.fn(),
		verifyPassword: vi.fn()
	}));
	vi.doMock('../lib/server/auth/users.js', () => ({
		getUserByUsername: vi.fn()
	}));
	vi.doMock('../lib/server/auth/credentials.js', () => ({
		verifyManagedUserPassword: vi.fn()
	}));
	vi.doMock('../lib/server/logger.js', () => ({
		logger: { error: errorLog, info: vi.fn(), warn: vi.fn() }
	}));

	createDefaultAdminIfNeeded = (
		await importFresh<BootstrapAdminModule>('../lib/server/auth/bootstrap-admin.js')
	).createDefaultAdminIfNeeded;
});

afterEach(() => {
	if (originalAdminPassword === undefined) delete process.env.ADMIN_PASSWORD;
	else process.env.ADMIN_PASSWORD = originalAdminPassword;
	sqlite.close();
	vi.restoreAllMocks();
	vi.resetModules();
});

describe('local admin bootstrap', () => {
	test('persists the setup token before creating the hashed admin account', async () => {
		const persistSetupToken = vi.fn(() => '/tmp/gyre-setup-token');

		await expect(createDefaultAdminIfNeeded({ persistSetupToken })).resolves.toEqual({
			password: 'Generated-strong-password1!',
			mode: 'local'
		});

		expect(persistSetupToken).toHaveBeenCalledWith('Generated-strong-password1!');
		expect(db.select().from(schema.users).all()).toEqual([
			expect.objectContaining({ id: 'generated-1', username: 'admin', role: 'admin' })
		]);
		expect(db.select().from(schema.accounts).all()).toEqual([
			expect.objectContaining({
				providerId: 'credential',
				userId: 'generated-1',
				password: 'hash:Generated-strong-password1!'
			})
		]);
	});

	test('does not create an admin when setup-token persistence fails', async () => {
		const persistenceError = new Error('permission denied');
		const persistSetupToken = vi.fn(() => {
			throw persistenceError;
		});

		await expect(createDefaultAdminIfNeeded({ persistSetupToken })).rejects.toBe(persistenceError);
		expect(db.select().from(schema.users).all()).toHaveLength(0);
		expect(errorLog).toHaveBeenCalledWith(
			persistenceError,
			expect.stringContaining('Failed to persist local setup token')
		);
	});
});
