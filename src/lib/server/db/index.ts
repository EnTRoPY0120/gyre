import { logger } from '../logger.js';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { mkdir } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { dirname, normalize } from 'node:path';
import * as schema from './schema.js';

// Determine database path
// - Production (in-cluster): /data/gyre.db (PersistentVolume mount)
// - Local development: ./data/gyre.db (relative to project root)
const isInCluster = !!process.env.KUBERNETES_SERVICE_HOST;
const databaseUrl = process.env.DATABASE_URL || (isInCluster ? '/data/gyre.db' : './data/gyre.db');
if (process.env.DATABASE_URL) {
	const normalized = normalize(databaseUrl);
	const segments = normalized.split(/[\\/]/);
	if (segments.some((seg) => seg === '..')) {
		throw new Error('DATABASE_URL must not contain path traversal sequences (..)');
	}
}
logger.info(`[DB] Database location: ${databaseUrl}`);

// Ensure directory exists (async)
async function ensureDbDirectory() {
	const dir = dirname(databaseUrl);
	try {
		await mkdir(dir, { recursive: true });
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
			logger.error(err, `[DB] Failed to create database directory: ${dir}`);
			throw err;
		}
	}
}

// Ensure directory exists (sync)
function ensureDbDirectorySync() {
	const dir = dirname(databaseUrl);
	try {
		mkdirSync(dir, { recursive: true });
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
			logger.error(err, `[DB] Failed to create database directory: ${dir}`);
			throw err;
		}
	}
}

// Initialize database
let sqliteConnection: Database.Database | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let dbInitPromise: Promise<void> | null = null;

export async function getDb() {
	if (!db) {
		if (!dbInitPromise) {
			dbInitPromise = (async () => {
				await ensureDbDirectory();
				const sqlite = new Database(databaseUrl);
				// Enable WAL mode for better concurrency
				sqlite.pragma('journal_mode = WAL');
				sqlite.pragma('foreign_keys = ON');
				sqliteConnection = sqlite;
				db = drizzle(sqlite, { schema });
			})().finally(() => {
				dbInitPromise = null;
			});
		}
		await dbInitPromise;
	}
	return db!;
}

// For synchronous usage (server-side only)
export function getDbSync() {
	if (dbInitPromise) {
		throw new Error(
			'[DB] Async initialization is in progress. ' +
				'Ensure initializeGyre() has completed or await getDb() before calling getDbSync().'
		);
	}
	if (!db) {
		ensureDbDirectorySync(); // Create directory if it doesn't exist
		const sqlite = new Database(databaseUrl);
		sqlite.pragma('journal_mode = WAL');
		sqlite.pragma('foreign_keys = ON');
		sqliteConnection = sqlite;
		db = drizzle(sqlite, { schema });
	}
	return db;
}

export function closeDb() {
	if (sqliteConnection) {
		logger.info('[DB] Closing database connection...');
		sqliteConnection.close();
		sqliteConnection = null;
		db = null;
	}
}

// Export schema for migrations
export { schema };

// Export types
export type {
	User,
	NewUser,
	Session,
	NewSession,
	AuditLog,
	NewAuditLog,
	Cluster,
	NewCluster,
	ClusterContext,
	NewClusterContext,
	RbacPolicy,
	NewRbacPolicy,
	RbacBinding,
	NewRbacBinding,
	ReconciliationHistory,
	NewReconciliationHistory
} from './schema.js';
