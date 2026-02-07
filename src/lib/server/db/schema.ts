import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql, relations } from 'drizzle-orm';

// Users table
export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	email: text('email'),
	role: text('role', { enum: ['admin', 'editor', 'viewer'] })
		.notNull()
		.default('viewer'),
	active: integer('active', { mode: 'boolean' }).notNull().default(true),
	isLocal: integer('is_local', { mode: 'boolean' }).notNull().default(true), // true = local auth (password), false = SSO-only
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

// Sessions table
export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

// Audit logs table
export const auditLogs = sqliteTable('audit_logs', {
	id: text('id').primaryKey(),
	userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
	action: text('action').notNull(), // 'read', 'write', 'delete', 'login', 'logout', etc.
	resourceType: text('resource_type'), // 'GitRepository', 'Kustomization', etc.
	resourceName: text('resource_name'),
	namespace: text('namespace'),
	clusterId: text('cluster_id'),
	details: text('details'), // JSON string with additional details
	success: integer('success', { mode: 'boolean' }).notNull().default(true),
	ipAddress: text('ip_address'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

// Clusters table (for uploaded kubeconfigs or in-cluster)
export const clusters = sqliteTable('clusters', {
	id: text('id').primaryKey(),
	name: text('name').notNull().unique(),
	description: text('description'),
	// For local mode: encrypted kubeconfig YAML
	// For in-cluster mode: null (uses ServiceAccount)
	kubeconfigEncrypted: text('kubeconfig_encrypted'),
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
	isLocal: integer('is_local', { mode: 'boolean' }).notNull().default(false), // true if uploaded via UI, false if in-cluster
	contextCount: integer('context_count').notNull().default(1),
	lastConnectedAt: integer('last_connected_at', { mode: 'timestamp' }),
	lastError: text('last_error'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

// Cluster contexts table (for multi-context kubeconfigs)
export const clusterContexts = sqliteTable('cluster_contexts', {
	id: text('id').primaryKey(),
	clusterId: text('cluster_id')
		.notNull()
		.references(() => clusters.id, { onDelete: 'cascade' }),
	contextName: text('context_name').notNull(),
	isCurrent: integer('is_current', { mode: 'boolean' }).notNull().default(false),
	server: text('server'), // Kubernetes API server URL
	namespaceRestrictions: text('namespace_restrictions'), // JSON array of allowed namespaces (null = all)
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

// RBAC Policies table
export const rbacPolicies = sqliteTable('rbac_policies', {
	id: text('id').primaryKey(),
	name: text('name').notNull().unique(),
	description: text('description'),
	role: text('role', { enum: ['admin', 'editor', 'viewer'] }).notNull(),
	resourceType: text('resource_type'), // 'GitRepository', 'Kustomization', etc. (null = all types)
	action: text('action', { enum: ['read', 'write', 'admin'] }).notNull(), // read=view, write=suspend/resume/reconcile, admin=delete/manage
	namespacePattern: text('namespace_pattern'), // Regex pattern for namespace matching (null = all namespaces)
	clusterId: text('cluster_id').references(() => clusters.id, { onDelete: 'cascade' }), // null = applies to all clusters
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

// RBAC Bindings table (links users to policies)
export const rbacBindings = sqliteTable(
	'rbac_bindings',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		policyId: text('policy_id')
			.notNull()
			.references(() => rbacPolicies.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`)
	},
	(table) => {
		return {
			pk: primaryKey({ columns: [table.userId, table.policyId] })
		};
	}
);

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type Cluster = typeof clusters.$inferSelect;
export type NewCluster = typeof clusters.$inferInsert;
export type ClusterContext = typeof clusterContexts.$inferSelect;
export type NewClusterContext = typeof clusterContexts.$inferInsert;
export type RbacPolicy = typeof rbacPolicies.$inferSelect;
export type NewRbacPolicy = typeof rbacPolicies.$inferInsert;
export type RbacBinding = typeof rbacBindings.$inferSelect;
export type NewRbacBinding = typeof rbacBindings.$inferInsert;

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

// User Providers table (links users to their SSO provider)
export const userProviders = sqliteTable(
	'user_providers',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		providerId: text('provider_id')
			.notNull()
			.references(() => authProviders.id, { onDelete: 'cascade' }),
		providerUserId: text('provider_user_id').notNull(), // User ID from IdP (sub claim)
		lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`)
	},
	(table) => {
		return {
			pk: primaryKey({ columns: [table.userId, table.providerId] })
		};
	}
);

// Auth Provider relations
export const authProviderRelations = relations(authProviders, ({ many }) => ({
	userProviders: many(userProviders)
}));

// User Provider relations
export const userProviderRelations = relations(userProviders, ({ one }) => ({
	user: one(users, {
		fields: [userProviders.userId],
		references: [users.id]
	}),
	provider: one(authProviders, {
		fields: [userProviders.providerId],
		references: [authProviders.id]
	})
}));

// User relations (add SSO providers)
export const userRelations = relations(users, ({ many }) => ({
	sessions: many(sessions),
	ssoProviders: many(userProviders)
}));

export type AuthProvider = typeof authProviders.$inferSelect;
export type NewAuthProvider = typeof authProviders.$inferInsert;
export type UserProvider = typeof userProviders.$inferSelect;
export type NewUserProvider = typeof userProviders.$inferInsert;
