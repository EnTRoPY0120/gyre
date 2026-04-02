import { logger } from '../../logger.js';
import { sql } from 'drizzle-orm';
import type { getDbSync } from '../index.js';

type Db = ReturnType<typeof getDbSync>;

export function initClusterTables(db: Db): void {
	db.run(sql`
		CREATE TABLE IF NOT EXISTS clusters (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL UNIQUE,
			description TEXT,
			kubeconfig_encrypted TEXT,
			is_active INTEGER NOT NULL DEFAULT 1,
			is_local INTEGER NOT NULL DEFAULT 0,
			context_count INTEGER NOT NULL DEFAULT 1,
			last_connected_at INTEGER,
			last_error TEXT,
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			updated_at INTEGER NOT NULL DEFAULT (unixepoch())
		)
	`);

	db.run(sql`
		CREATE TABLE IF NOT EXISTS cluster_contexts (
			id TEXT PRIMARY KEY,
			cluster_id TEXT NOT NULL,
			context_name TEXT NOT NULL,
			is_current INTEGER NOT NULL DEFAULT 0,
			server TEXT,
			namespace_restrictions TEXT,
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			FOREIGN KEY (cluster_id) REFERENCES clusters(id) ON DELETE CASCADE
		)
	`);

	// Migration: add unique constraint on cluster_contexts(cluster_id, context_name)
	try {
		const result = db
			.select({ value: sql`value` })
			.from(sql`app_settings`)
			.where(sql`key = 'migrations.cluster_context_unique'`)
			.get() as { value: string } | undefined;

		if (!result || result.value !== 'true') {
			db.transaction((tx) => {
				// Keep the canonical row per (cluster_id, context_name): prefer is_current=1, then newest created_at
				tx.run(sql`
					DELETE FROM cluster_contexts
					WHERE id NOT IN (
						SELECT id FROM (
							SELECT id,
								ROW_NUMBER() OVER (
									PARTITION BY cluster_id, context_name
									ORDER BY is_current DESC, created_at DESC
								) AS rn
							FROM cluster_contexts
						) WHERE rn = 1
					)
				`);
				tx.run(sql`
					INSERT OR REPLACE INTO app_settings (key, value, updated_at)
					VALUES ('migrations.cluster_context_unique', 'true', (unixepoch()))
				`);
			});
			logger.info('[DB] Migration: added unique constraint on cluster_contexts');
		}
	} catch (error) {
		logger.error(error, '[DB] Failed to add unique constraint on cluster_contexts:');
		throw error;
	}

	// Always ensure the index exists (IF NOT EXISTS makes this idempotent)
	try {
		db.run(sql`
			CREATE UNIQUE INDEX IF NOT EXISTS idx_cluster_contexts_cluster_context
			ON cluster_contexts (cluster_id, context_name)
		`);
	} catch (error) {
		logger.error(error, '[DB] Failed to add unique constraint on cluster_contexts:');
		throw error;
	}
}
