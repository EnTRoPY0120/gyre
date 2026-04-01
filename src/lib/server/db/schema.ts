/**
 * Database schema barrel file.
 * Table definitions live in ./schemas/ organized by domain.
 * Relations are defined here to avoid circular imports across domain files.
 */

import { relations } from 'drizzle-orm';

// Re-export all table definitions and types
export * from './schemas/auth.schema.js';
export * from './schemas/clusters.schema.js';
export * from './schemas/rbac.schema.js';
export * from './schemas/audit.schema.js';
export * from './schemas/security.schema.js';
export * from './schemas/app.schema.js';

// Import tables needed for relation definitions
import { users, sessions, accounts } from './schemas/auth.schema.js';
import { clusters, clusterContexts } from './schemas/clusters.schema.js';
import { rbacPolicies, rbacBindings } from './schemas/rbac.schema.js';
import { auditLogs, reconciliationHistory } from './schemas/audit.schema.js';
import { passwordHistory } from './schemas/security.schema.js';

// Relations are defined here (not in domain files) because they reference
// tables across multiple domains and would otherwise create circular imports.

export const userRelations = relations(users, ({ many }) => ({
	sessions: many(sessions),
	accounts: many(accounts),
	auditLogs: many(auditLogs),
	passwordHistories: many(passwordHistory),
	rbacBindings: many(rbacBindings)
}));

export const sessionRelations = relations(sessions, ({ one }) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id]
	})
}));

export const accountRelations = relations(accounts, ({ one }) => ({
	user: one(users, {
		fields: [accounts.userId],
		references: [users.id]
	})
}));

export const auditLogRelations = relations(auditLogs, ({ one }) => ({
	user: one(users, {
		fields: [auditLogs.userId],
		references: [users.id]
	})
}));

export const passwordHistoryRelations = relations(passwordHistory, ({ one }) => ({
	user: one(users, {
		fields: [passwordHistory.userId],
		references: [users.id]
	})
}));

export const clusterRelations = relations(clusters, ({ many }) => ({
	contexts: many(clusterContexts),
	rbacPolicies: many(rbacPolicies)
}));

export const clusterContextRelations = relations(clusterContexts, ({ one }) => ({
	cluster: one(clusters, {
		fields: [clusterContexts.clusterId],
		references: [clusters.id]
	})
}));

export const rbacPolicyRelations = relations(rbacPolicies, ({ one, many }) => ({
	cluster: one(clusters, {
		fields: [rbacPolicies.clusterId],
		references: [clusters.id]
	}),
	bindings: many(rbacBindings)
}));

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

export const reconciliationHistoryRelations = relations(reconciliationHistory, ({ one }) => ({
	triggeredBy: one(users, {
		fields: [reconciliationHistory.triggeredByUser],
		references: [users.id]
	})
}));
