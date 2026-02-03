import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import * as schema from './schema.js';

// Determine database path
const databaseUrl = process.env.DATABASE_URL || './data/gyre.db';

// Ensure directory exists
async function ensureDbDirectory() {
	if (databaseUrl.startsWith('./') || databaseUrl.startsWith('/') || !databaseUrl.includes('://')) {
		const dir = dirname(databaseUrl);
		try {
			await mkdir(dir, { recursive: true });
		} catch {
			// Directory might already exist
		}
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
	Dashboard,
	NewDashboard,
	DashboardWidget,
	NewDashboardWidget
} from './schema.js';
