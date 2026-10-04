import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../lib/server/db/schema.js';
import * as nodeFs from 'node:fs';

vi.mock('node:fs', async (importOriginal) => {
	const fs = await importOriginal<typeof import('node:fs')>();
	return { ...fs, renameSync: vi.fn(fs.renameSync) };
});
import { BackupError, restoreFromBuffer } from '../lib/server/backup.js';

const backupFixtureEnv = vi.hoisted(() => {
	const root = `${process.env.TMPDIR || '/tmp'}/backup-restore-${process.pid}-${Date.now()}`;
	const originalDatabaseUrl = process.env.DATABASE_URL;
	const originalBackupDir = process.env.BACKUP_DIR;
	const originalDatabaseRoot = process.env.GYRE_RUNTIME_DATABASE_ROOT;
	const originalBackupRoot = process.env.GYRE_RUNTIME_BACKUP_ROOT;
	const originalRuntimeTestMode = process.env.GYRE_RUNTIME_TEST_MODE;

	process.env.DATABASE_URL = `${root}/gyre.db`;
	process.env.BACKUP_DIR = `${root}/backups`;
	process.env.GYRE_RUNTIME_DATABASE_ROOT = root;
	process.env.GYRE_RUNTIME_BACKUP_ROOT = root;
	process.env.GYRE_RUNTIME_TEST_MODE = '1';
	delete process.env.BACKUP_ENCRYPTION_KEY;

	return {
		root,
		originalDatabaseUrl,
		originalBackupDir,
		originalDatabaseRoot,
		originalBackupRoot,
		originalRuntimeTestMode
	};
});

const databasePath = `${backupFixtureEnv.root}/gyre.db`;
const backupPath = `${backupFixtureEnv.root}/backups`;

type Layout = 'current' | 'pre-issuer' | 'legacy';
function createSqliteBuffer(
	layout: Layout = 'current',
	mutate?: (db: Database.Database) => void
): Buffer {
	const database = new Database(':memory:');
	try {
		database.exec(
			nodeFs.readFileSync(new URL(`./fixtures/backups/${layout}.sql`, import.meta.url), 'utf8')
		);
		mutate?.(database);
		return database.serialize();
	} finally {
		database.close();
	}
}

function assertLivePreserved() {
	const db = new Database(databasePath, { readonly: true });
	try {
		expect(db.prepare('SELECT value FROM current_marker').get()).toEqual({ value: 'current' });
	} finally {
		db.close();
	}
	expect(
		nodeFs.readdirSync(backupFixtureEnv.root).filter((name) => name.startsWith('.gyre-restore-'))
	).toEqual([]);
}

function seedCurrentDatabase(): void {
	const database = new Database(databasePath);
	try {
		database.exec('CREATE TABLE current_marker (value TEXT)');
		database.prepare('INSERT INTO current_marker (value) VALUES (?)').run('current');
	} finally {
		database.close();
	}
}

beforeEach(() => {
	nodeFs.rmSync(backupFixtureEnv.root, { recursive: true, force: true });
	nodeFs.mkdirSync(backupPath, { recursive: true });
});

afterAll(() => {
	nodeFs.rmSync(backupFixtureEnv.root, { recursive: true, force: true });

	if (backupFixtureEnv.originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
	else process.env.DATABASE_URL = backupFixtureEnv.originalDatabaseUrl;
	if (backupFixtureEnv.originalBackupDir === undefined) delete process.env.BACKUP_DIR;
	else process.env.BACKUP_DIR = backupFixtureEnv.originalBackupDir;
	if (backupFixtureEnv.originalDatabaseRoot === undefined)
		delete process.env.GYRE_RUNTIME_DATABASE_ROOT;
	else process.env.GYRE_RUNTIME_DATABASE_ROOT = backupFixtureEnv.originalDatabaseRoot;
	if (backupFixtureEnv.originalBackupRoot === undefined)
		delete process.env.GYRE_RUNTIME_BACKUP_ROOT;
	else process.env.GYRE_RUNTIME_BACKUP_ROOT = backupFixtureEnv.originalBackupRoot;
	if (backupFixtureEnv.originalRuntimeTestMode === undefined)
		delete process.env.GYRE_RUNTIME_TEST_MODE;
	else process.env.GYRE_RUNTIME_TEST_MODE = backupFixtureEnv.originalRuntimeTestMode;
});

describe('restoreFromBuffer', () => {
	test('rejects invalid SQLite headers before creating a safety backup', async () => {
		await expect(restoreFromBuffer(Buffer.from('not a database'))).rejects.toMatchObject({
			name: 'BackupError',
			status: 400,
			message: 'Invalid file: not a valid SQLite database'
		});

		expect(nodeFs.readdirSync(backupPath)).toEqual([]);
	});

	test('rejects invalid SQLite page sizes', async () => {
		const invalidHeader = Buffer.concat([
			Buffer.from('SQLite format 3\0', 'ascii'),
			Buffer.from([1, 0])
		]);

		await expect(restoreFromBuffer(invalidHeader)).rejects.toMatchObject({
			name: 'BackupError',
			status: 400,
			message: 'Invalid file: SQLite page size is not a valid power of 2'
		});
	});

	test.each([
		['missing table', (db: Database.Database) => db.exec('DROP TABLE auth_providers')],
		[
			'missing column',
			(db: Database.Database) => db.exec('ALTER TABLE clusters DROP COLUMN kubeconfig_encrypted')
		],
		[
			'missing primary key',
			(db: Database.Database) =>
				db.exec(
					'DROP TABLE rbac_bindings; CREATE TABLE rbac_bindings (user_id TEXT NOT NULL, policy_id TEXT NOT NULL, created_at INTEGER NOT NULL)'
				)
		],
		[
			'missing foreign key',
			(db: Database.Database) =>
				db.exec(
					'DROP TABLE rbac_bindings; CREATE TABLE rbac_bindings (user_id TEXT NOT NULL, policy_id TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(user_id, policy_id))'
				)
		],
		[
			'broken reference',
			(db: Database.Database) => {
				db.pragma('foreign_keys = OFF');
				db.exec(
					"INSERT INTO accounts (id, provider_id, issuer, account_id, user_id) VALUES ('orphan','credential','local:credential','orphan','missing')"
				);
			}
		],
		[
			'migration failure',
			(db: Database.Database) => {
				db.exec('DROP INDEX idx_accounts_issuer_account');
				db.exec(
					"INSERT INTO users (id, username) VALUES ('u','u'); INSERT INTO accounts (id, provider_id, account_id, user_id, issuer) VALUES ('a','x','same','u','shared'),('b','y','same','u','shared')"
				);
			}
		]
	])('rejects %s before safety backup or live replacement', async (_name, mutate) => {
		seedCurrentDatabase();
		await expect(restoreFromBuffer(createSqliteBuffer('current', mutate))).rejects.toMatchObject({
			name: 'BackupError',
			status: 400
		});
		assertLivePreserved();
		expect(nodeFs.readdirSync(backupPath)).toEqual([]);
	});

	test('rejects corrupt SQLite pages with a clear error and cleans up', async () => {
		seedCurrentDatabase();
		const buffer = createSqliteBuffer();
		buffer.fill(0xff, 100, 200);
		await expect(restoreFromBuffer(buffer)).rejects.toBeInstanceOf(BackupError);
		assertLivePreserved();
		expect(nodeFs.readdirSync(backupPath)).toEqual([]);
	});

	test.each<Layout>(['current', 'pre-issuer', 'legacy'])(
		'upgrades %s in one pass, preserving login, SSO, encrypted data, cluster and RBAC',
		async (layout) => {
			seedCurrentDatabase();
			const hash = await bcrypt.hash('RestorePassword!1', 4);
			const buffer = createSqliteBuffer(layout, (db) => {
				if (layout === 'legacy') {
					db.prepare(
						"INSERT INTO users (id, username, email, password_hash) VALUES ('u','alice','alice@example.com',?)"
					).run(hash);
				} else {
					db.exec(
						"INSERT INTO users (id, username, email) VALUES ('u','alice','alice@example.com')"
					);
					db.prepare(
						"INSERT INTO accounts (id, provider_id, account_id, user_id, password) VALUES ('password','credential','u','u',?)"
					).run(hash);
				}
				db.exec(
					"INSERT INTO auth_providers (id, name, type, client_id, client_secret_encrypted) VALUES ('company/oidc','sso','oidc','client','encrypted-secret')"
				);
				if (layout === 'legacy') {
					db.exec(
						"INSERT INTO user_providers (provider_id, provider_user_id, user_id, access_token_encrypted, refresh_token_encrypted) VALUES ('company/oidc','subject','u','encrypted-access','encrypted-refresh')"
					);
				} else {
					db.exec(
						"INSERT INTO accounts (id, provider_id, account_id, user_id, access_token_encrypted, refresh_token_encrypted) VALUES ('sso','company/oidc','subject','u','encrypted-access','encrypted-refresh')"
					);
				}
				db.exec(
					"INSERT INTO clusters (id, name, kubeconfig_encrypted) VALUES ('c','cluster','encrypted-kubeconfig'); INSERT INTO cluster_contexts (id, cluster_id, context_name) VALUES ('ctx','c','default'); INSERT INTO rbac_policies (id, name, role, action, cluster_id) VALUES ('p','policy','viewer','read','c'); INSERT INTO rbac_bindings (user_id, policy_id) VALUES ('u','p')"
				);
				// Populated legacy sessions exercise adding columns and NOT NULL in the first pass.
				db.exec(
					'INSERT INTO sessions (id, user_id, expires_at' +
						(layout === 'legacy' ? '' : ',token') +
						") VALUES ('session','u',2000000000" +
						(layout === 'legacy' ? '' : ",'token'") +
						')'
				);
			});
			await expect(restoreFromBuffer(buffer)).resolves.toMatchObject({
				filename: 'restored-database',
				encrypted: false
			});
			expect(nodeFs.readdirSync(backupPath)).toHaveLength(1);
			const db = new Database(databasePath);
			try {
				const auth = betterAuth({
					baseURL: 'http://localhost:3000',
					secret: 'restore-test-auth-secret-with-enough-entropy',
					database: drizzleAdapter(drizzle(db, { schema }), { provider: 'sqlite', schema }),
					user: { modelName: 'users' },
					session: { modelName: 'sessions' },
					account: { modelName: 'accounts' },
					verification: { modelName: 'verifications' },
					emailAndPassword: {
						enabled: true,
						password: {
							hash: (password) => bcrypt.hash(password, 4),
							verify: ({ hash, password }) => bcrypt.compare(password, hash)
						}
					}
				});
				const login = await auth.api.signInEmail({
					body: { email: 'alice@example.com', password: 'RestorePassword!1' }
				});
				expect(login.user.id).toBe('u');
				const ctx = await auth.$context;
				expect(
					await ctx.internalAdapter.findAccountByKey({
						issuer: 'local:oauth:company%2Foidc',
						accountId: 'subject'
					})
				).toMatchObject({ userId: 'u' });
				expect(
					db
						.prepare(
							"SELECT access_token_encrypted, refresh_token_encrypted FROM accounts WHERE provider_id = 'company/oidc'"
						)
						.get()
				).toEqual({
					access_token_encrypted: 'encrypted-access',
					refresh_token_encrypted: 'encrypted-refresh'
				});
				expect(db.prepare('SELECT client_secret_encrypted FROM auth_providers').get()).toEqual({
					client_secret_encrypted: 'encrypted-secret'
				});
				expect(db.prepare('SELECT kubeconfig_encrypted FROM clusters').get()).toEqual({
					kubeconfig_encrypted: 'encrypted-kubeconfig'
				});
				expect(db.prepare('SELECT user_id, policy_id FROM rbac_bindings').get()).toEqual({
					user_id: 'u',
					policy_id: 'p'
				});
				expect(db.pragma('foreign_key_check')).toEqual([]);
			} finally {
				db.close();
			}
			expect(
				nodeFs
					.readdirSync(backupFixtureEnv.root)
					.filter((name) => name.startsWith('.gyre-restore-'))
			).toEqual([]);
		}
	);

	test('atomic rename failure preserves live data with no copy fallback', async () => {
		seedCurrentDatabase();
		vi.mocked(nodeFs.renameSync).mockImplementationOnce(() => {
			throw Object.assign(new Error('cross-device swap'), { code: 'EXDEV' });
		});
		await expect(restoreFromBuffer(createSqliteBuffer())).rejects.toThrow('cross-device swap');
		assertLivePreserved();
		expect(nodeFs.readdirSync(backupPath)).toHaveLength(1);
	});

	test('sidecar cleanup failure aborts replacement', async () => {
		seedCurrentDatabase();
		nodeFs.mkdirSync(databasePath + '-shm');
		await expect(restoreFromBuffer(createSqliteBuffer())).rejects.toThrow();
		assertLivePreserved();
	});

	test('safety backup failure aborts replacement after candidate validation', async () => {
		seedCurrentDatabase();
		nodeFs.rmSync(backupPath, { recursive: true });
		nodeFs.writeFileSync(backupPath, 'not a directory');
		await expect(restoreFromBuffer(createSqliteBuffer())).rejects.toMatchObject({
			status: 500,
			message: expect.stringContaining('safety backup')
		});
		assertLivePreserved();
	});

	test('rejects overlapping restores without disturbing the accepted restore', async () => {
		seedCurrentDatabase();
		const candidate = createSqliteBuffer();
		const first = restoreFromBuffer(candidate);
		await expect(restoreFromBuffer(candidate)).rejects.toMatchObject({ status: 409 });
		await expect(first).resolves.toMatchObject({ filename: 'restored-database' });
		expect(
			nodeFs.readdirSync(backupFixtureEnv.root).filter((name) => name.startsWith('.gyre-restore-'))
		).toEqual([]);
	});

	test('aborts a busy checkpoint without replacing the live database', async () => {
		seedCurrentDatabase();
		const writer = new Database(databasePath);
		writer.pragma('journal_mode = WAL');
		const reader = new Database(databasePath);
		reader.exec('BEGIN; SELECT * FROM current_marker');
		writer.exec("INSERT INTO current_marker VALUES ('new')");
		try {
			await expect(restoreFromBuffer(createSqliteBuffer())).rejects.toMatchObject({ status: 409 });
		} finally {
			reader.exec('ROLLBACK');
			reader.close();
			writer.close();
		}
		assertLivePreserved();
	}, 15000);
});
