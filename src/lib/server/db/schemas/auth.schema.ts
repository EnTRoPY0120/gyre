import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import type { UserPreferences } from '$lib/types/user';

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	username: text('username').notNull().unique(),
	email: text('email'),
	name: text('name').notNull().default(''),
	emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
	image: text('image'),
	role: text('role', { enum: ['admin', 'editor', 'viewer'] })
		.notNull()
		.default('viewer'),
	active: integer('active', { mode: 'boolean' }).notNull().default(true),
	isLocal: integer('is_local', { mode: 'boolean' }).notNull().default(true), // true = local auth (password), false = SSO-only
	requiresPasswordChange: integer('requires_password_change', { mode: 'boolean' })
		.notNull()
		.default(false),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	preferences: text('preferences', { mode: 'json' }).$type<UserPreferences>()
});

export const sessions = sqliteTable(
	'sessions',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		token: text('token').notNull().unique(),
		expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`)
	},
	(table) => ({
		expiresAtIdx: index('idx_sessions_expires_at').on(table.expiresAt),
		userIdIdx: index('idx_sessions_user_id').on(table.userId),
		tokenIdx: uniqueIndex('idx_sessions_token').on(table.token)
	})
);

export const accounts = sqliteTable(
	'accounts',
	{
		id: text('id').primaryKey(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
		providerId: text('provider_id').notNull(),
		accountId: text('account_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
		refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
		scope: text('scope'),
		password: text('password'),
		lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
		accessTokenEncrypted: text('access_token_encrypted'),
		refreshTokenEncrypted: text('refresh_token_encrypted'),
		idTokenEncrypted: text('id_token_encrypted')
	},
	(table) => ({
		providerAccountIdx: uniqueIndex('idx_accounts_provider_account').on(
			table.providerId,
			table.accountId
		),
		userIdIdx: index('idx_accounts_user_id').on(table.userId)
	})
);

export const verifications = sqliteTable(
	'verifications',
	{
		id: text('id').primaryKey(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
		value: text('value').notNull(),
		expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
		identifier: text('identifier').notNull()
	},
	(table) => ({
		identifierIdx: index('idx_verifications_identifier').on(table.identifier),
		valueIdx: index('idx_verifications_value').on(table.value)
	})
);

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Verification = typeof verifications.$inferSelect;
export type NewVerification = typeof verifications.$inferInsert;
