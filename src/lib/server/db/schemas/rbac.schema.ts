import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './auth.schema.js';
import { clusters } from './clusters.schema.js';

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

// Types
export type RbacPolicy = typeof rbacPolicies.$inferSelect;
export type NewRbacPolicy = typeof rbacPolicies.$inferInsert;
export type RbacBinding = typeof rbacBindings.$inferSelect;
export type NewRbacBinding = typeof rbacBindings.$inferInsert;
