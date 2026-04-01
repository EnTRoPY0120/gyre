import { logger } from '../../logger.js';
import { sql } from 'drizzle-orm';
import type { getDbSync } from '../index.js';
import type { MigrationFlags } from './auth-tables.js';

type Db = ReturnType<typeof getDbSync>;

export function initSecurityTables(db: Db, flags: MigrationFlags): void {
	const { hasLegacyUserProviders } = flags;

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
				id, provider_id, account_id, user_id,
				last_login_at, access_token_encrypted, refresh_token_encrypted,
				access_token_expires_at, created_at, updated_at
			)
			SELECT
				'oauth:' || provider_id || ':' || provider_user_id,
				provider_id, provider_user_id, user_id,
				last_login_at, access_token_encrypted, refresh_token_encrypted,
				token_expires_at, created_at,
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

	// Login Lockouts table
	db.run(sql`
		CREATE TABLE IF NOT EXISTS login_lockouts (
			username TEXT PRIMARY KEY,
			failed_attempts INTEGER NOT NULL DEFAULT 0,
			locked_until INTEGER,
			updated_at INTEGER NOT NULL DEFAULT (unixepoch())
		)
	`);

	// Rate Limits table
	db.run(sql`
		CREATE TABLE IF NOT EXISTS rate_limits (
			key TEXT PRIMARY KEY,
			current_window_count INTEGER NOT NULL DEFAULT 0,
			previous_window_count INTEGER NOT NULL DEFAULT 0,
			last_window_start INTEGER NOT NULL DEFAULT 0,
			expire_at INTEGER NOT NULL DEFAULT (unixepoch() + 120),
			updated_at INTEGER NOT NULL DEFAULT (unixepoch())
		)
	`);
	db.run(sql`CREATE INDEX IF NOT EXISTS idx_rate_limits_expire_at ON rate_limits (expire_at)`);
	// Migration: add expire_at to tables created before this column was introduced
	try {
		db.run(
			sql`ALTER TABLE rate_limits ADD COLUMN expire_at INTEGER NOT NULL DEFAULT (unixepoch() + 120)`
		);
	} catch {
		// Column already exists — safe to ignore
	}

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

	// Indexes
	db.run(
		sql`CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history (user_id)`
	);
	db.run(
		sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_password_history_user_hash ON password_history (user_id, password_hash)`
	);
}
