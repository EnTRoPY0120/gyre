import { sql } from 'drizzle-orm';
import type { getDbSync } from '../index.js';

type Db = ReturnType<typeof getDbSync>;

export function initAuditTables(db: Db): void {
	db.run(sql`
		CREATE TABLE IF NOT EXISTS audit_logs (
			id TEXT PRIMARY KEY,
			user_id TEXT,
			action TEXT NOT NULL,
			resource_type TEXT,
			resource_name TEXT,
			namespace TEXT,
			cluster_id TEXT,
			details TEXT,
			success INTEGER NOT NULL DEFAULT 1,
			ip_address TEXT,
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
		)
	`);

	// Cleanup: drop dashboard tables removed in an earlier release
	db.run(sql`DROP TABLE IF EXISTS dashboard_widgets`);
	db.run(sql`DROP TABLE IF EXISTS dashboards`);

	db.run(sql`
		CREATE TABLE IF NOT EXISTS reconciliation_history (
			id TEXT PRIMARY KEY,
			resource_type TEXT NOT NULL,
			namespace TEXT NOT NULL,
			name TEXT NOT NULL,
			cluster_id TEXT NOT NULL DEFAULT 'in-cluster',
			revision TEXT,
			previous_revision TEXT,
			status TEXT NOT NULL,
			ready_status TEXT,
			ready_reason TEXT,
			ready_message TEXT,
			reconcile_started_at INTEGER,
			reconcile_completed_at INTEGER NOT NULL,
			duration_ms INTEGER,
			spec_snapshot TEXT,
			metadata_snapshot TEXT,
			trigger_type TEXT NOT NULL DEFAULT 'automatic',
			triggered_by_user TEXT,
			error_message TEXT,
			stalled_reason TEXT,
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			FOREIGN KEY (triggered_by_user) REFERENCES users(id) ON DELETE SET NULL
		)
	`);

	// Indexes
	db.run(sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id)`);
	db.run(sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action)`);
	db.run(sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at)`);
	db.run(
		sql`CREATE INDEX IF NOT EXISTS idx_resource_lookup ON reconciliation_history (resource_type, namespace, name, cluster_id)`
	);
	db.run(
		sql`CREATE INDEX IF NOT EXISTS idx_cluster_time ON reconciliation_history (cluster_id, reconcile_completed_at)`
	);
	db.run(sql`CREATE INDEX IF NOT EXISTS idx_status ON reconciliation_history (status)`);
}
