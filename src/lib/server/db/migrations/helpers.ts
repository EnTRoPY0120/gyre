import type { SQL } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { logger } from '../../logger.js';
import type { getDbSync } from '../index.js';

export type Db = ReturnType<typeof getDbSync>;
export type MigrationDb = Pick<Db, 'run' | 'select'>;

function isDuplicateColumnError(err: unknown): boolean {
	if (!(err instanceof Error)) return false;

	if (err.message.includes('duplicate column name')) {
		return true;
	}

	const cause = 'cause' in err ? err.cause : undefined;
	return cause instanceof Error && cause.message.includes('duplicate column name');
}

export function addColumnsIgnoringDuplicates(db: Db, ddls: SQL[], errorMessage: string): void {
	for (const ddl of ddls) {
		try {
			db.run(ddl);
		} catch (err) {
			if (isDuplicateColumnError(err)) {
				continue;
			}
			logger.error(err, errorMessage);
			throw err;
		}
	}
}

function hasMigrationFlag(db: Db, key: string): boolean {
	const result = db
		.select({ value: sql`value` })
		.from(sql`app_settings`)
		.where(sql`key = ${key}`)
		.get() as { value: string } | undefined;

	return result?.value === 'true';
}

function setMigrationFlag(tx: MigrationDb, key: string): void {
	tx.run(
		sql`INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (${key}, 'true', (unixepoch()))`
	);
}

export function runFlaggedMigration(options: {
	db: Db;
	key: string;
	successMessage: string;
	failureMessage: string;
	run: (tx: MigrationDb) => void;
}): void {
	try {
		if (!hasMigrationFlag(options.db, options.key)) {
			options.db.transaction((tx) => {
				options.run(tx);
				setMigrationFlag(tx, options.key);
			});
			logger.info(options.successMessage);
		}
	} catch (error) {
		logger.error(error, options.failureMessage);
		throw error;
	}
}
