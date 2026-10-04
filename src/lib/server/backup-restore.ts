import type Database from 'better-sqlite3';
import { migrateDatabase } from './db/migrate.js';
import {
	validateBackupSchema,
	validateSourceSchema,
	validateDatabaseIntegrity
} from './backup-schema.js';
import { BackupError } from './backup-errors.js';

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

/** Validate and migrate a disposable candidate before any live database operation. */
export function prepareRestoreCandidate(database: Database.Database): void {
	try {
		validateDatabaseIntegrity(database);
		validateSourceSchema(database);
		migrateDatabase(database);
		validateBackupSchema(database);
		validateDatabaseIntegrity(database);
		// Fold all candidate data into its main file before the same-filesystem rename.
		checkpointDatabase(database);
		database.pragma('journal_mode = DELETE');
	} catch (error) {
		if (error instanceof BackupError) throw error;
		throw new BackupError('Invalid backup: database validation or migration failed', 400);
	}
}

export function checkpointDatabase(database: Database.Database): void {
	const result = database.pragma('wal_checkpoint(TRUNCATE)') as { busy: number }[];
	if (result.some(({ busy }) => busy !== 0)) {
		throw new BackupError(
			'Database checkpoint is busy. Restore aborted; retry when database activity has finished.',
			409
		);
	}
}
