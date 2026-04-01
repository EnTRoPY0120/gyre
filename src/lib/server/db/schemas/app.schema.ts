import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Auth Providers table (SSO configuration)
export const authProviders = sqliteTable('auth_providers', {
	id: text('id').primaryKey(),
	name: text('name').notNull().unique(), // Display name (e.g., "Company Okta")
	type: text('type', {
		enum: ['oidc', 'oauth2-github', 'oauth2-google', 'oauth2-gitlab', 'oauth2-generic']
	}).notNull(),
	enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),

	// OAuth2/OIDC Configuration
	clientId: text('client_id').notNull(),
	clientSecretEncrypted: text('client_secret_encrypted').notNull(), // Encrypted at rest
	issuerUrl: text('issuer_url'), // OIDC issuer (e.g., https://accounts.google.com)
	authorizationUrl: text('authorization_url'), // OAuth2 authorization endpoint
	tokenUrl: text('token_url'), // OAuth2 token endpoint
	userInfoUrl: text('user_info_url'), // OAuth2 user info endpoint
	jwksUrl: text('jwks_url'), // OIDC JWKS endpoint for token validation

	// Auto-provisioning settings
	autoProvision: integer('auto_provision', { mode: 'boolean' }).notNull().default(true),
	defaultRole: text('default_role', { enum: ['admin', 'editor', 'viewer'] })
		.notNull()
		.default('viewer'),

	// Role mapping (JSON: { "admin": ["Admins"], "editor": ["Developers"] })
	roleMapping: text('role_mapping'), // Maps IdP groups to Gyre roles
	roleClaim: text('role_claim').notNull().default('groups'), // Claim name for groups

	// User claim mappings
	usernameClaim: text('username_claim').notNull().default('preferred_username'),
	emailClaim: text('email_claim').notNull().default('email'),

	// PKCE support
	usePkce: integer('use_pkce', { mode: 'boolean' }).notNull().default(true),

	// Scopes (space-separated)
	scopes: text('scopes').notNull().default('openid profile email'),

	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

// App Settings table (key-value store for application configuration)
export const appSettings = sqliteTable('app_settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

// Types
export type AuthProvider = typeof authProviders.$inferSelect;
export type NewAuthProvider = typeof authProviders.$inferInsert;
export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;
