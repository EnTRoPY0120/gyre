import { logger } from '../logger.js';
import { getDbSync } from './index.js';
import { sql } from 'drizzle-orm';

/**
 * Initialize database tables
 * Creates all necessary tables with the complete schema
 */
export function initDatabase(): void {
	const db = getDbSync();

	// App Settings table (must be initialized first to store migration flags)
	db.run(sql`
		CREATE TABLE IF NOT EXISTS app_settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL,
			updated_at INTEGER NOT NULL DEFAULT (unixepoch())
		)
	`);

	// Users table
	db.run(sql`
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			username TEXT NOT NULL UNIQUE COLLATE NOCASE,
			password_hash TEXT NOT NULL,
			email TEXT,
			role TEXT NOT NULL DEFAULT 'viewer',
			active INTEGER NOT NULL DEFAULT 1,
			is_local INTEGER NOT NULL DEFAULT 1,
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
			preferences TEXT
		)
	`);

	// Migration: ensure existing data is lowercased (run once)
	try {
		const result = db
			.select({ value: sql`value` })
			.from(sql`app_settings`)
			.where(sql`key = 'migrations.users_lowercased'`)
			.get() as { value: string } | undefined;

		if (!result || result.value !== 'true') {
			db.transaction((tx) => {
				// Collision-aware normalization: detect duplicates before bulk UPDATE
				const allUsers = tx
					.select({ id: sql`id`, username: sql`username` })
					.from(sql`users`)
					.all() as { id: string; username: string }[];

				// Group by the normalized form to find collisions
				const groups = new Map<string, { id: string; username: string }[]>();
				for (const user of allUsers) {
					const normalized = user.username.toLowerCase().trim();
					if (!groups.has(normalized)) {
						groups.set(normalized, []);
					}
					groups.get(normalized)!.push(user);
				}

				// Apply per-row updates, resolving collisions with ordinal suffixes
				for (const [normalized, group] of groups) {
					if (group.length === 1) {
						tx.run(sql`UPDATE users SET username = ${normalized} WHERE id = ${group[0].id}`);
					} else {
						// Sort deterministically by id so suffix assignment is stable
						group.sort((a, b) => a.id.localeCompare(b.id));
						for (let i = 0; i < group.length; i++) {
							const finalUsername = i === 0 ? normalized : `${normalized}_${i}`;
							tx.run(sql`UPDATE users SET username = ${finalUsername} WHERE id = ${group[i].id}`);
						}
						logger.warn(`[DB] Migration: resolved username collision across ${group.length} users`);
					}
				}

				tx.run(
					sql`INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('migrations.users_lowercased', 'true', (unixepoch()))`
				);
			});
			logger.info('[DB] Migration: lowercased existing usernames');
		}
	} catch (error) {
		logger.error(error, '[DB] Failed to run username normalization migration:');
		throw error;
	}

	// Add preferences column if it doesn't exist (for existing databases)
	try {
		db.run(sql`ALTER TABLE users ADD COLUMN preferences TEXT`);
	} catch {
		// Column might already exist
	}

	// Sessions table
	db.run(sql`
		CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			expires_at INTEGER NOT NULL,
			ip_address TEXT,
			user_agent TEXT,
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)
	`);

	// Audit logs table
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

	// Clusters table
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

	// Cluster contexts table
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
				// Remove any pre-existing duplicates (keep lowest id per pair)
				tx.run(sql`
					DELETE FROM cluster_contexts
					WHERE id NOT IN (
						SELECT MIN(id) FROM cluster_contexts
						GROUP BY cluster_id, context_name
					)
				`);
				tx.run(sql`
					CREATE UNIQUE INDEX IF NOT EXISTS idx_cluster_contexts_cluster_context
					ON cluster_contexts (cluster_id, context_name)
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

	// RBAC Policies table
	db.run(sql`
		CREATE TABLE IF NOT EXISTS rbac_policies (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL UNIQUE,
			description TEXT,
			role TEXT NOT NULL,
			resource_type TEXT,
			action TEXT NOT NULL,
			namespace_pattern TEXT,
			cluster_id TEXT,
			is_active INTEGER NOT NULL DEFAULT 1,
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
			FOREIGN KEY (cluster_id) REFERENCES clusters(id) ON DELETE CASCADE
		)
	`);

	// RBAC Bindings table
	db.run(sql`
		CREATE TABLE IF NOT EXISTS rbac_bindings (
			user_id TEXT NOT NULL,
			policy_id TEXT NOT NULL,
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			PRIMARY KEY (user_id, policy_id),
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
			FOREIGN KEY (policy_id) REFERENCES rbac_policies(id) ON DELETE CASCADE
		)
	`);

	// Auth Providers table (for SSO)
	db.run(sql`
		CREATE TABLE IF NOT EXISTS auth_providers (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL UNIQUE,
			type TEXT NOT NULL,
			enabled INTEGER NOT NULL DEFAULT 1,
			client_id TEXT NOT NULL,
			client_secret_encrypted TEXT NOT NULL,
			issuer_url TEXT,
			authorization_url TEXT,
			token_url TEXT,
			user_info_url TEXT,
			jwks_url TEXT,
			auto_provision INTEGER NOT NULL DEFAULT 1,
			default_role TEXT NOT NULL DEFAULT 'viewer',
			role_mapping TEXT,
			role_claim TEXT NOT NULL DEFAULT 'groups',
			username_claim TEXT NOT NULL DEFAULT 'preferred_username',
			email_claim TEXT NOT NULL DEFAULT 'email',
			use_pkce INTEGER NOT NULL DEFAULT 1,
			scopes TEXT NOT NULL DEFAULT 'openid profile email',
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			updated_at INTEGER NOT NULL DEFAULT (unixepoch())
		)
	`);

	// User Providers table (links users to SSO providers)
	db.run(sql`
		CREATE TABLE IF NOT EXISTS user_providers (
			user_id TEXT NOT NULL,
			provider_id TEXT NOT NULL,
			provider_user_id TEXT NOT NULL,
			last_login_at INTEGER,
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			PRIMARY KEY (user_id, provider_id),
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
			FOREIGN KEY (provider_id) REFERENCES auth_providers(id) ON DELETE CASCADE
		)
	`);

	// Migration: Drop dashboard tables if they exist (cleanup from removed feature)
	db.run(sql`
		DROP TABLE IF EXISTS dashboard_widgets
	`);
	db.run(sql`
		DROP TABLE IF EXISTS dashboards
	`);

	// Reconciliation History table
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

	// Login Lockouts table
	initLockoutsTable(db);

	// Password History table
	db.run(sql`
		CREATE TABLE IF NOT EXISTS password_history (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			password_hash TEXT NOT NULL,
			created_at_ms INTEGER NOT NULL,
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)
	`);

	// Indexes (CREATE INDEX IF NOT EXISTS is idempotent — safe for new and existing databases)
	db.run(sql`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at)`);
	db.run(sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id)`);
	db.run(sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id)`);
	db.run(sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action)`);
	db.run(sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at)`);
	db.run(
		sql`CREATE INDEX IF NOT EXISTS idx_rbac_bindings_policy_user ON rbac_bindings (policy_id, user_id)`
	);
	db.run(
		sql`CREATE INDEX IF NOT EXISTS idx_rbac_policies_cluster_id ON rbac_policies (cluster_id)`
	);
	db.run(
		sql`CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history (user_id)`
	);
	db.run(
		sql`CREATE INDEX IF NOT EXISTS idx_resource_lookup ON reconciliation_history (resource_type, namespace, name, cluster_id)`
	);
	db.run(
		sql`CREATE INDEX IF NOT EXISTS idx_cluster_time ON reconciliation_history (cluster_id, reconcile_completed_at)`
	);
	db.run(sql`CREATE INDEX IF NOT EXISTS idx_status ON reconciliation_history (status)`);

	logger.info('✓ Database tables initialized');
}

/**
 * Initialize login lockouts table
 */
function initLockoutsTable(db: ReturnType<typeof getDbSync>): void {
	db.run(sql`
		CREATE TABLE IF NOT EXISTS login_lockouts (
			username TEXT PRIMARY KEY,
			failed_attempts INTEGER NOT NULL DEFAULT 0,
			locked_until INTEGER,
			updated_at INTEGER NOT NULL DEFAULT (unixepoch())
		)
	`);
}
