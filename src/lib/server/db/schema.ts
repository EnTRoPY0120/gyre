import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

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
