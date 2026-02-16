import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { mkdir, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from './schema.js';

// Determine database path
// - Production (in-cluster): /data/gyre.db (PersistentVolume mount)
// - Local development: ./data/gyre.db (relative to project root)
const isInCluster = !!process.env.KUBERNETES_SERVICE_HOST;
const databaseUrl = process.env.DATABASE_URL || (isInCluster ? '/data/gyre.db' : './data/gyre.db');
console.log(`[DB] Database location: ${databaseUrl}`);

// Ensure directory exists (async)
async function ensureDbDirectory() {
	const dir = dirname(databaseUrl);
	try {
		await mkdir(dir, { recursive: true }, () => {});
	} catch {
		// Directory might already exist
	}
}

// Ensure directory exists (sync)
function ensureDbDirectorySync() {
	const dir = dirname(databaseUrl);
	try {
		mkdirSync(dir, { recursive: true });
	} catch {
		// Directory might already exist
	}
}

// Initialize database
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export async function getDb() {
	if (!db) {
		await ensureDbDirectory();
		const sqlite = new Database(databaseUrl);
		// Enable WAL mode for better concurrency
		sqlite.pragma('journal_mode = WAL');
		sqlite.pragma('foreign_keys = ON');
		db = drizzle(sqlite, { schema });
	}
	return db;
}

// For synchronous usage (server-side only)
export function getDbSync() {
	if (!db) {
		ensureDbDirectorySync(); // Create directory if it doesn't exist
		const sqlite = new Database(databaseUrl);
		sqlite.pragma('journal_mode = WAL');
		sqlite.pragma('foreign_keys = ON');
		db = drizzle(sqlite, { schema });
	}
	return db;
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
