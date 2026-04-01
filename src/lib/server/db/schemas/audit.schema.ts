import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './auth.schema.js';

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

// Types
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type ReconciliationHistory = typeof reconciliationHistory.$inferSelect;
export type NewReconciliationHistory = typeof reconciliationHistory.$inferInsert;
