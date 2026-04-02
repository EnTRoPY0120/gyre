import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './auth.schema.js';

// Password History table (tracks last N password hashes per user)
export const passwordHistory = sqliteTable(
	'password_history',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		passwordHash: text('password_hash').notNull(),
		createdAtMs: integer('created_at_ms').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`)
	},
	(table) => ({
		userIdIdx: index('idx_password_history_user_id').on(table.userId),
		userHashUniqueIdx: uniqueIndex('idx_password_history_user_hash').on(
			table.userId,
			table.passwordHash
		)
	})
);

// Login Lockouts table (for persistent account lockout tracking)
export const loginLockouts = sqliteTable('login_lockouts', {
	username: text('username').primaryKey(), // Canonical username
	failedAttempts: integer('failed_attempts').notNull().default(0),
	lockedUntil: integer('locked_until', { mode: 'timestamp' }),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

// Rate Limits table (for persistent sliding-window rate limiting)
// lastWindowStart stores raw milliseconds (Date.now()) — do NOT use { mode: 'timestamp' }
// as that would divide by 1000 and break the sliding window algorithm.
export const rateLimits = sqliteTable('rate_limits', {
	key: text('key').primaryKey(),
	currentWindowCount: integer('current_window_count').notNull().default(0),
	previousWindowCount: integer('previous_window_count').notNull().default(0),
	lastWindowStart: integer('last_window_start').notNull().default(0),
	// expireAt is set to currentWindowStart + 2 * windowMs on every write so cleanup()
	// deletes only rows whose sliding window has fully elapsed, not by a fixed horizon.
	expireAt: integer('expire_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date(Date.now() + 120_000)),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// Types
export type PasswordHistory = typeof passwordHistory.$inferSelect;
export type NewPasswordHistory = typeof passwordHistory.$inferInsert;
export type LoginLockout = typeof loginLockouts.$inferSelect;
export type NewLoginLockout = typeof loginLockouts.$inferInsert;
export type RateLimit = typeof rateLimits.$inferSelect;
export type NewRateLimit = typeof rateLimits.$inferInsert;
