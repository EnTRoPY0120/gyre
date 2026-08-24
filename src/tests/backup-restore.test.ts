import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import Database from 'better-sqlite3';
import * as nodeFs from 'node:fs';
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

const requiredTables = [
	'users',
	'sessions',
	'verifications',
	'app_settings',
	'clusters',
	'cluster_contexts',
	'audit_logs',
	'rbac_policies',
	'rbac_bindings',
	'auth_providers',
	'accounts'
];

let fixtureSequence = 0;

function createSqliteBuffer(tables: string[], includeRestoredMarker = false): Buffer {
	const fixturePath = `${backupFixtureEnv.root}/fixture-${fixtureSequence++}.db`;
	const database = new Database(fixturePath);

	try {
		for (const table of tables) {
			if (table === 'users') {
				database.exec('CREATE TABLE users (id TEXT, username TEXT, role TEXT)');
			} else {
				database.exec(`CREATE TABLE "${table}" (id TEXT)`);
			}
		}
		if (includeRestoredMarker) {
			database.exec('CREATE TABLE restored_marker (value TEXT)');
			database.prepare('INSERT INTO restored_marker (value) VALUES (?)').run('restored');
		}
	} finally {
		database.close();
	}

	const buffer = nodeFs.readFileSync(fixturePath);
	nodeFs.unlinkSync(fixturePath);
	return buffer;
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
	fixtureSequence = 0;
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

	test('rejects incomplete schemas while preserving the current database', async () => {
		seedCurrentDatabase();

		await expect(restoreFromBuffer(createSqliteBuffer(['users']))).rejects.toMatchObject({
			name: 'BackupError',
			status: 400,
			message: expect.stringContaining('Invalid backup: missing required tables:')
		});

		const current = new Database(databasePath, { readonly: true });
		try {
			expect(current.prepare('SELECT value FROM current_marker').get()).toEqual({
				value: 'current'
			});
		} finally {
			current.close();
		}
		expect(nodeFs.readdirSync(backupPath).some((file) => file.endsWith('.db'))).toBe(true);
	});

	test('replaces the database after validating a complete backup', async () => {
		seedCurrentDatabase();

		const result = await restoreFromBuffer(createSqliteBuffer(requiredTables, true));

		expect(result).toMatchObject({
			filename: 'restored-database',
			encrypted: false
		});
		expect(result.sizeBytes).toBeGreaterThan(0);

		const restored = new Database(databasePath, { readonly: true });
		try {
			expect(restored.prepare('SELECT value FROM restored_marker').get()).toEqual({
				value: 'restored'
			});
			expect(() => restored.prepare('SELECT value FROM current_marker').get()).toThrow();
		} finally {
			restored.close();
		}
	});

	test('exposes BackupError for invalid input rather than a raw database exception', async () => {
		const error = await restoreFromBuffer(
			createSqliteBuffer(['users', 'sessions', 'verifications', 'app_settings'])
		).catch((value: unknown) => value);

		expect(error).toBeInstanceOf(BackupError);
	});
});
