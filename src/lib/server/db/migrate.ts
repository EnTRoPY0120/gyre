import { logger } from '../logger.js';
import { getDbSync } from './index.js';
import { sql } from 'drizzle-orm';

/**
 * Initialize database tables
 * Creates all necessary tables with the complete schema
 */
export function initDatabase(): void {
	const db = getDbSync();
	const hasLegacyUserProviders =
		(db
			.select({ name: sql`name` })
			.from(sql`sqlite_master`)
			.where(sql`type = 'table' AND name = 'user_providers'`)
			.get() as { name: string } | undefined) != null;
	const hasLegacyPasswordHashColumn =
		(db
			.select({ name: sql`name` })
			.from(sql`pragma_table_info('users')`)
			.where(sql`name = 'password_hash'`)
			.get() as { name: string } | undefined) != null;
	const hasNullableSessionToken =
		(db
			.select({ notnull: sql<number>`notnull` })
			.from(sql`pragma_table_info('sessions')`)
			.where(sql`name = 'token' AND notnull = 0`)
			.get() as { notnull: number } | undefined) != null;

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
			email TEXT,
			name TEXT NOT NULL DEFAULT '',
			email_verified INTEGER NOT NULL DEFAULT 0,
			image TEXT,
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
	for (const ddl of [
		sql`ALTER TABLE users ADD COLUMN preferences TEXT`,
		sql`ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT ''`,
		sql`ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0`,
		sql`ALTER TABLE users ADD COLUMN image TEXT`,
		sql`ALTER TABLE users ADD COLUMN requires_password_change INTEGER NOT NULL DEFAULT 0`
	]) {
		try {
			db.run(ddl);
		} catch (err) {
			if (err instanceof Error && err.message.includes('duplicate column name')) {
				continue;
			}
			logger.error(err, '[DB] Failed to add Better Auth user column:');
			throw err;
		}
	}

	// Backfill new Better Auth-compatible user fields for existing rows.
	db.run(sql`UPDATE users SET name = username WHERE name = '' OR name IS NULL`);

	// Sessions table
	db.run(sql`
		CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			token TEXT NOT NULL UNIQUE,
			expires_at INTEGER NOT NULL,
			ip_address TEXT,
			user_agent TEXT,
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)
	`);

	for (const ddl of [
		sql`ALTER TABLE sessions ADD COLUMN token TEXT`,
		sql`ALTER TABLE sessions ADD COLUMN updated_at INTEGER NOT NULL DEFAULT (unixepoch())`
	]) {
		try {
			db.run(ddl);
		} catch (err) {
			if (err instanceof Error && err.message.includes('duplicate column name')) {
				continue;
			}
			logger.error(err, '[DB] Failed to add Better Auth session column:');
			throw err;
		}
	}

	db.run(sql`UPDATE sessions SET token = id WHERE token IS NULL OR token = ''`);
	db.run(sql`UPDATE sessions SET updated_at = created_at WHERE updated_at IS NULL`);

	if (hasNullableSessionToken) {
		db.run(sql`PRAGMA foreign_keys = OFF`);
		try {
			db.transaction((tx) => {
				tx.run(sql`
					CREATE TABLE sessions_next (
						id TEXT PRIMARY KEY,
						user_id TEXT NOT NULL,
						token TEXT NOT NULL UNIQUE,
						expires_at INTEGER NOT NULL,
						ip_address TEXT,
						user_agent TEXT,
						created_at INTEGER NOT NULL DEFAULT (unixepoch()),
						updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
						FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
					)
				`);
				tx.run(sql`
					INSERT INTO sessions_next (id, user_id, token, expires_at, ip_address, user_agent, created_at, updated_at)
					SELECT id, user_id, token, expires_at, ip_address, user_agent, created_at, updated_at
					FROM sessions
				`);
				tx.run(sql`DROP TABLE sessions`);
				tx.run(sql`ALTER TABLE sessions_next RENAME TO sessions`);
			});
		} catch (err) {
			logger.error(err, '[DB] Failed to enforce NOT NULL on sessions.token:');
			throw err;
		} finally {
			db.run(sql`PRAGMA foreign_keys = ON`);
		}
	}

	// Better Auth accounts table
	db.run(sql`
		CREATE TABLE IF NOT EXISTS accounts (
			id TEXT PRIMARY KEY,
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
			provider_id TEXT NOT NULL,
			account_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			access_token TEXT,
			refresh_token TEXT,
			id_token TEXT,
			access_token_expires_at INTEGER,
			refresh_token_expires_at INTEGER,
			scope TEXT,
			password TEXT,
			last_login_at INTEGER,
			access_token_encrypted TEXT,
			refresh_token_encrypted TEXT,
			id_token_encrypted TEXT,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)
	`);

	for (const ddl of [
		sql`ALTER TABLE accounts ADD COLUMN last_login_at INTEGER`,
		sql`ALTER TABLE accounts ADD COLUMN access_token_encrypted TEXT`,
		sql`ALTER TABLE accounts ADD COLUMN refresh_token_encrypted TEXT`,
		sql`ALTER TABLE accounts ADD COLUMN id_token_encrypted TEXT`
	]) {
		try {
			db.run(ddl);
		} catch (err) {
			if (err instanceof Error && err.message.includes('duplicate column name')) {
				continue;
			}
			logger.error(err, '[DB] Failed to add Better Auth account column:');
			throw err;
		}
	}

	if (hasLegacyPasswordHashColumn) {
		db.run(sql`
			INSERT OR IGNORE INTO accounts (
				id,
				provider_id,
				account_id,
				user_id,
				password,
				created_at,
				updated_at
			)
			SELECT
				'credential:' || id,
				'credential',
				id,
				id,
				password_hash,
				created_at,
				updated_at
			FROM users
			WHERE is_local = 1
				AND password_hash IS NOT NULL
				AND password_hash != ''
		`);
	}

	// Better Auth verifications table
	db.run(sql`
		CREATE TABLE IF NOT EXISTS verifications (
			id TEXT PRIMARY KEY,
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
			value TEXT NOT NULL,
			expires_at INTEGER NOT NULL,
			identifier TEXT NOT NULL
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

	if (hasLegacyUserProviders) {
		for (const ddl of [
			sql`ALTER TABLE user_providers ADD COLUMN access_token_encrypted TEXT`,
			sql`ALTER TABLE user_providers ADD COLUMN refresh_token_encrypted TEXT`,
			sql`ALTER TABLE user_providers ADD COLUMN token_expires_at INTEGER`
		]) {
			try {
				db.run(ddl);
			} catch (err) {
				if (err instanceof Error && err.message.includes('duplicate column name')) {
					continue;
				}
				logger.error(err, '[DB] Failed to add OAuth token column to legacy user_providers:');
				throw err;
			}
		}

		db.run(sql`
			INSERT OR IGNORE INTO accounts (
				id,
				provider_id,
				account_id,
				user_id,
				last_login_at,
				access_token_encrypted,
				refresh_token_encrypted,
				access_token_expires_at,
				created_at,
				updated_at
			)
			SELECT
				'oauth:' || provider_id || ':' || provider_user_id,
				provider_id,
				provider_user_id,
				user_id,
				last_login_at,
				access_token_encrypted,
				refresh_token_encrypted,
				token_expires_at,
				created_at,
				COALESCE(last_login_at, created_at)
			FROM user_providers
		`);

		db.run(sql`
			UPDATE accounts
			SET
				last_login_at = COALESCE(up.last_login_at, last_login_at),
				access_token_encrypted = COALESCE(up.access_token_encrypted, access_token_encrypted),
				refresh_token_encrypted = COALESCE(up.refresh_token_encrypted, refresh_token_encrypted),
				access_token_expires_at = COALESCE(up.token_expires_at, access_token_expires_at)
			FROM user_providers AS up
			WHERE accounts.user_id = up.user_id
				AND accounts.provider_id = up.provider_id
				AND accounts.account_id = up.provider_user_id
				AND accounts.provider_id != 'credential'
		`);

		db.run(sql`DROP TABLE IF EXISTS user_providers`);
	}

	if (hasLegacyPasswordHashColumn) {
		db.run(sql`PRAGMA foreign_keys = OFF`);
		try {
			db.transaction((tx) => {
				tx.run(sql`
					CREATE TABLE users_next (
						id TEXT PRIMARY KEY,
						username TEXT NOT NULL UNIQUE COLLATE NOCASE,
						email TEXT,
						name TEXT NOT NULL DEFAULT '',
						email_verified INTEGER NOT NULL DEFAULT 0,
						image TEXT,
						role TEXT NOT NULL DEFAULT 'viewer',
						active INTEGER NOT NULL DEFAULT 1,
						is_local INTEGER NOT NULL DEFAULT 1,
						created_at INTEGER NOT NULL DEFAULT (unixepoch()),
						updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
						preferences TEXT
					)
				`);
				tx.run(sql`
					INSERT INTO users_next (
						id,
						username,
						email,
						name,
						email_verified,
						image,
						role,
						active,
						is_local,
						created_at,
						updated_at,
						preferences
					)
					SELECT
						id,
						username,
						email,
						COALESCE(name, username, ''),
						COALESCE(email_verified, 0),
						image,
						role,
						active,
						is_local,
						created_at,
						updated_at,
						preferences
					FROM users
				`);
				tx.run(sql`DROP TABLE users`);
				tx.run(sql`ALTER TABLE users_next RENAME TO users`);
			});
		} finally {
			db.run(sql`PRAGMA foreign_keys = ON`);
		}
	}

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

	// Rate Limits table
	initRateLimitsTable(db);

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

	// Migration: add unique constraint on password_history(user_id, password_hash)
	try {
		const result = db
			.select({ value: sql`value` })
			.from(sql`app_settings`)
			.where(sql`key = 'migrations.password_history_user_hash_unique'`)
			.get() as { value: string } | undefined;

		if (!result || result.value !== 'true') {
			db.transaction((tx) => {
				tx.run(sql`
					DELETE FROM password_history
					WHERE id NOT IN (
						SELECT MIN(id) FROM password_history
						GROUP BY user_id, password_hash
					)
				`);
				tx.run(sql`
					CREATE UNIQUE INDEX IF NOT EXISTS idx_password_history_user_hash
					ON password_history (user_id, password_hash)
				`);
				tx.run(sql`
					INSERT OR REPLACE INTO app_settings (key, value, updated_at)
					VALUES ('migrations.password_history_user_hash_unique', 'true', (unixepoch()))
				`);
			});
			logger.info('[DB] Migration: added unique constraint on password_history');
		}
	} catch (error) {
		logger.error(error, '[DB] Failed to add unique constraint on password_history:');
		throw error;
	}

	// Indexes (CREATE INDEX IF NOT EXISTS is idempotent — safe for new and existing databases)
	db.run(sql`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at)`);
	db.run(sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id)`);
	db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token ON sessions (token)`);
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
		sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_password_history_user_hash ON password_history (user_id, password_hash)`
	);
	db.run(
		sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_provider_account ON accounts (provider_id, account_id)`
	);
	db.run(sql`CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts (user_id)`);
	db.run(
		sql`CREATE INDEX IF NOT EXISTS idx_verifications_identifier ON verifications (identifier)`
	);
	db.run(sql`CREATE INDEX IF NOT EXISTS idx_verifications_value ON verifications (value)`);
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

/**
 * Initialize rate limits table for persistent sliding-window rate limiting
 */
function initRateLimitsTable(db: ReturnType<typeof getDbSync>): void {
	db.run(sql`
		CREATE TABLE IF NOT EXISTS rate_limits (
			key TEXT PRIMARY KEY,
			current_window_count INTEGER NOT NULL DEFAULT 0,
			previous_window_count INTEGER NOT NULL DEFAULT 0,
			last_window_start INTEGER NOT NULL DEFAULT 0,
			updated_at INTEGER NOT NULL DEFAULT (unixepoch())
		)
	`);
	db.run(sql`
		CREATE INDEX IF NOT EXISTS idx_rate_limits_updated_at ON rate_limits (updated_at)
	`);
}
