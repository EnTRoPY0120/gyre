import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

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

// Types
export type Cluster = typeof clusters.$inferSelect;
export type NewCluster = typeof clusters.$inferInsert;
export type ClusterContext = typeof clusterContexts.$inferSelect;
export type NewClusterContext = typeof clusterContexts.$inferInsert;
