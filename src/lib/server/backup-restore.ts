import type Database from 'better-sqlite3';
import { BackupError } from './backup-errors.js';

const REQUIRED_BACKUP_TABLES = [
	'users',
	'sessions',
	'verifications',
	'app_settings',
	'clusters',
	'cluster_contexts',
	'audit_logs',
	'rbac_policies',
	'rbac_bindings',
	'auth_providers'
];

/** Validate the SQLite header and page-size invariants before touching disk. */
export function validateRestoreBuffer(buffer: Buffer): void {
	const magic = buffer.subarray(0, 16).toString('ascii');
	if (magic !== 'SQLite format 3\0') {
		throw new BackupError('Invalid file: not a valid SQLite database', 400);
	}

	if (buffer.length < 18) {
		throw new BackupError('Invalid file: SQLite header is too short to read page size', 400);
	}

	const pageSize = buffer[16] === 0 && buffer[17] === 1 ? 65536 : buffer.readUInt16BE(16);
	if (pageSize < 512 || pageSize > 65536 || (pageSize & (pageSize - 1)) !== 0) {
		throw new BackupError('Invalid file: SQLite page size is not a valid power of 2', 400);
	}
}

/** Validate the schema contract required by the running application. */
export function validateBackupSchema(database: Database.Database): void {
	const tables = database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {
		name: string;
	}[];
	const tableNames = tables.map((table) => table.name);

	const missingTables = REQUIRED_BACKUP_TABLES.filter((table) => !tableNames.includes(table));
	if (missingTables.length > 0) {
		throw new BackupError(
			`Invalid backup: missing required tables: ${missingTables.join(', ')}`,
			400
		);
	}

	if (!tableNames.includes('accounts')) {
		throw new BackupError(
			'Invalid backup: missing required auth account data table: accounts',
			400
		);
	}

	const userColumns = database.prepare('PRAGMA table_info(users)').all() as { name: string }[];
	const userColumnNames = userColumns.map((column) => column.name);
	const requiredUserColumns = ['id', 'username', 'role'];
	const missingColumns = requiredUserColumns.filter((column) => !userColumnNames.includes(column));
	if (missingColumns.length > 0) {
		throw new BackupError(
			`Invalid backup: users table missing columns: ${missingColumns.join(', ')}`,
			400
		);
	}
}

/** Verify that the swapped database is internally consistent. */
export function validateRestoredDatabase(
	database: Database.Database,
	safetyBackupFilename: string
): void {
	const result = database.prepare('PRAGMA integrity_check').get() as {
		integrity_check: string;
	};
	if (result.integrity_check !== 'ok') {
		throw new BackupError(
			`Restored database failed integrity check: ${result.integrity_check}. ` +
				`The pre-restore database was preserved as safety backup "${safetyBackupFilename}" in the backup directory. ` +
				`Restore that file to recover the previous database.`,
			500
		);
	}
}
