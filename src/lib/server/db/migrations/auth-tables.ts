import { logger } from '../../logger.js';
import { sql } from 'drizzle-orm';
import type { getDbSync } from '../index.js';

type Db = ReturnType<typeof getDbSync>;

export interface MigrationFlags {
	hasLegacyUserProviders: boolean;
	hasLegacyPasswordHashColumn: boolean;
	hasNullableSessionToken: boolean;
}

/**
 * Initialize app_settings, users, sessions, accounts, and verifications tables.
 * app_settings is created first because other migrations use it as a flag store.
 */
export function initAuthTables(db: Db, flags: MigrationFlags): void {
	const { hasLegacyPasswordHashColumn, hasNullableSessionToken } = flags;

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

	// Migration: ensure existing usernames are lowercased (run once)
	try {
		const result = db
			.select({ value: sql`value` })
			.from(sql`app_settings`)
			.where(sql`key = 'migrations.users_lowercased'`)
			.get() as { value: string } | undefined;

		if (!result || result.value !== 'true') {
			db.transaction((tx) => {
				const allUsers = tx
					.select({ id: sql`id`, username: sql`username` })
					.from(sql`users`)
					.all() as { id: string; username: string }[];

				const groups = new Map<string, { id: string; username: string }[]>();
				for (const user of allUsers) {
					const normalized = user.username.toLowerCase().trim();
					if (!groups.has(normalized)) {
						groups.set(normalized, []);
					}
					groups.get(normalized)!.push(user);
				}

				// Pass 1: Set all users to unique temp names to avoid cross-update conflicts
				for (const user of allUsers) {
					const tempName = `__tmp__${user.id}`;
					tx.run(sql`UPDATE users SET username = ${tempName} WHERE id = ${user.id}`);
				}

				// Pass 2: Assign final names, tracking globally taken names to prevent collisions
				const taken = new Set<string>();
				for (const [normalized, group] of groups) {
					group.sort((a, b) => a.id.localeCompare(b.id));
					if (group.length > 1) {
						logger.warn(`[DB] Migration: resolved username collision across ${group.length} users`);
					}
					let counter = 1;
					for (let i = 0; i < group.length; i++) {
						let candidate = i === 0 ? normalized : `${normalized}_${i}`;
						while (taken.has(candidate)) {
							candidate = `${normalized}_${counter++}`;
						}
						taken.add(candidate);
						tx.run(sql`UPDATE users SET username = ${candidate} WHERE id = ${group[i].id}`);
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

	// Accounts table
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
				id, provider_id, account_id, user_id, password, created_at, updated_at
			)
			SELECT
				'credential:' || id, 'credential', id, id, password_hash, created_at, updated_at
			FROM users
			WHERE is_local = 1 AND password_hash IS NOT NULL AND password_hash != ''
		`);
	}

	// Verifications table
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
						preferences TEXT,
						requires_password_change INTEGER NOT NULL DEFAULT 0
					)
				`);
				tx.run(sql`
					INSERT INTO users_next (
						id, username, email, name, email_verified, image,
						role, active, is_local, created_at, updated_at, preferences,
						requires_password_change
					)
					SELECT
						id, username, email,
						COALESCE(name, username, ''),
						COALESCE(email_verified, 0),
						image, role, active, is_local, created_at, updated_at, preferences,
						COALESCE(requires_password_change, 0)
					FROM users
				`);
				tx.run(sql`DROP TABLE users`);
				tx.run(sql`ALTER TABLE users_next RENAME TO users`);
			});
		} finally {
			db.run(sql`PRAGMA foreign_keys = ON`);
		}
	}

	// Indexes
	db.run(sql`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at)`);
	db.run(sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id)`);
	db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token ON sessions (token)`);
	db.run(
		sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_provider_account ON accounts (provider_id, account_id)`
	);
	db.run(sql`CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts (user_id)`);
	db.run(
		sql`CREATE INDEX IF NOT EXISTS idx_verifications_identifier ON verifications (identifier)`
	);
	db.run(sql`CREATE INDEX IF NOT EXISTS idx_verifications_value ON verifications (value)`);
}
