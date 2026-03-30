import {
	sqliteTable,
	text,
	integer,
	primaryKey,
	index,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';
import { sql, relations } from 'drizzle-orm';
import type { UserPreferences } from '$lib/types/user';

// Users table
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
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	preferences: text('preferences', { mode: 'json' }).$type<UserPreferences>()
});

// Sessions table
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

// Better Auth accounts table
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

// Better Auth verifications table
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

// Audit logs table
export const auditLogs = sqliteTable(
	'audit_logs',
	{
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
	},
	(table) => ({
		userIdIdx: index('idx_audit_logs_user_id').on(table.userId),
		actionIdx: index('idx_audit_logs_action').on(table.action),
		createdAtIndex: index('idx_audit_logs_created_at').on(table.createdAt)
	})
);

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
export const clusterContexts = sqliteTable(
	'cluster_contexts',
	{
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
	},
	(table) => ({
		clusterContextUnique: uniqueIndex('idx_cluster_contexts_cluster_context').on(
			table.clusterId,
			table.contextName
		)
	})
);

// RBAC Policies table
export const rbacPolicies = sqliteTable(
	'rbac_policies',
	{
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
	},
	(table) => ({
		clusterIdIdx: index('idx_rbac_policies_cluster_id').on(table.clusterId)
	})
);

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
			pk: primaryKey({ columns: [table.userId, table.policyId] }),
			policyUserIdx: index('idx_rbac_bindings_policy_user').on(table.policyId, table.userId)
		};
	}
);

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

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Verification = typeof verifications.$inferSelect;
export type NewVerification = typeof verifications.$inferInsert;
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
export type PasswordHistory = typeof passwordHistory.$inferSelect;
export type NewPasswordHistory = typeof passwordHistory.$inferInsert;

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

// User relations
export const userRelations = relations(users, ({ many }) => ({
	sessions: many(sessions),
	accounts: many(accounts),
	auditLogs: many(auditLogs),
	passwordHistories: many(passwordHistory),
	rbacBindings: many(rbacBindings)
}));

// Session relations
export const sessionRelations = relations(sessions, ({ one }) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id]
	})
}));

// Better Auth account relations
export const accountRelations = relations(accounts, ({ one }) => ({
	user: one(users, {
		fields: [accounts.userId],
		references: [users.id]
	})
}));

// Audit log relations
export const auditLogRelations = relations(auditLogs, ({ one }) => ({
	user: one(users, {
		fields: [auditLogs.userId],
		references: [users.id]
	})
}));

// Password history relations
export const passwordHistoryRelations = relations(passwordHistory, ({ one }) => ({
	user: one(users, {
		fields: [passwordHistory.userId],
		references: [users.id]
	})
}));

// Cluster relations
export const clusterRelations = relations(clusters, ({ many }) => ({
	contexts: many(clusterContexts),
	rbacPolicies: many(rbacPolicies)
}));

// Cluster context relations
export const clusterContextRelations = relations(clusterContexts, ({ one }) => ({
	cluster: one(clusters, {
		fields: [clusterContexts.clusterId],
		references: [clusters.id]
	})
}));

// RBAC Policy relations
export const rbacPolicyRelations = relations(rbacPolicies, ({ one, many }) => ({
	cluster: one(clusters, {
		fields: [rbacPolicies.clusterId],
		references: [clusters.id]
	}),
	bindings: many(rbacBindings)
}));

// RBAC Binding relations
export const rbacBindingRelations = relations(rbacBindings, ({ one }) => ({
	user: one(users, {
		fields: [rbacBindings.userId],
		references: [users.id]
	}),
	policy: one(rbacPolicies, {
		fields: [rbacBindings.policyId],
		references: [rbacPolicies.id]
	})
}));

export type AuthProvider = typeof authProviders.$inferSelect;
export type NewAuthProvider = typeof authProviders.$inferInsert;

// App Settings table (key-value store for application configuration)
export const appSettings = sqliteTable('app_settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;

// Login Lockouts table (for persistent account lockout tracking)
export const loginLockouts = sqliteTable('login_lockouts', {
	username: text('username').primaryKey(), // Canonical username
	failedAttempts: integer('failed_attempts').notNull().default(0),
	lockedUntil: integer('locked_until', { mode: 'timestamp' }),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export type LoginLockout = typeof loginLockouts.$inferSelect;
export type NewLoginLockout = typeof loginLockouts.$inferInsert;

// Reconciliation History table (tracks all reconciliation attempts for FluxCD resources)
export const reconciliationHistory = sqliteTable(
	'reconciliation_history',
	{
		id: text('id').primaryKey(),

		// Resource Identifier
		resourceType: text('resource_type').notNull(),
		namespace: text('namespace').notNull(),
		name: text('name').notNull(),
		clusterId: text('cluster_id').notNull().default('in-cluster'),

		// Reconciliation Metadata
		revision: text('revision'),
		previousRevision: text('previous_revision'),

		// Status Tracking
		status: text('status', { enum: ['success', 'failure', 'unknown'] }).notNull(),
		readyStatus: text('ready_status', { enum: ['True', 'False', 'Unknown'] }),
		readyReason: text('ready_reason'),
		readyMessage: text('ready_message'),

		// Timing Data
		reconcileStartedAt: integer('reconcile_started_at', { mode: 'timestamp' }),
		reconcileCompletedAt: integer('reconcile_completed_at', { mode: 'timestamp' }).notNull(),
		durationMs: integer('duration_ms'),

		// Snapshot Data (for rollback)
		specSnapshot: text('spec_snapshot'), // JSON
		metadataSnapshot: text('metadata_snapshot'), // JSON

		// Trigger Tracking
		triggerType: text('trigger_type', {
			enum: ['automatic', 'manual', 'webhook', 'rollback']
		})
			.notNull()
			.default('automatic'),
		triggeredByUser: text('triggered_by_user').references(() => users.id, {
			onDelete: 'set null'
		}),

		// Error Details
		errorMessage: text('error_message'),
		stalledReason: text('stalled_reason'),

		// Timestamps
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`)
	},
	(table) => ({
		resourceLookupIdx: index('idx_resource_lookup').on(
			table.resourceType,
			table.namespace,
			table.name,
			table.clusterId
		),
		clusterTimeIdx: index('idx_cluster_time').on(table.clusterId, table.reconcileCompletedAt),
		statusIdx: index('idx_status').on(table.status)
	})
);

export type ReconciliationHistory = typeof reconciliationHistory.$inferSelect;
export type NewReconciliationHistory = typeof reconciliationHistory.$inferInsert;

// Reconciliation history relations
export const reconciliationHistoryRelations = relations(reconciliationHistory, ({ one }) => ({
	triggeredBy: one(users, {
		fields: [reconciliationHistory.triggeredByUser],
		references: [users.id]
	})
}));
