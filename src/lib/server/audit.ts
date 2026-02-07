import { eq, desc, and } from 'drizzle-orm';
import { getDbSync, type NewAuditLog } from './db/index.js';
import { auditLogs } from './db/schema.js';
import type { User } from './db/schema.js';

/**
 * Log an audit event
 */
export async function logAudit(
	user: User | null,
	action: string,
	options: {
		resourceType?: string;
		resourceName?: string;
		namespace?: string;
		clusterId?: string;
		details?: Record<string, unknown>;
		success?: boolean;
		ipAddress?: string;
	} = {}
): Promise<void> {
	try {
		const db = getDbSync();

		const logEntry: NewAuditLog = {
			id: crypto.randomUUID(),
			userId: user?.id || null,
			action,
			resourceType: options.resourceType || null,
			resourceName: options.resourceName || null,
			namespace: options.namespace || null,
			clusterId: options.clusterId || null,
			details: options.details ? JSON.stringify(options.details) : null,
			success: options.success ?? true,
			ipAddress: options.ipAddress || null
		};

		await db.insert(auditLogs).values(logEntry);
	} catch (error) {
		// Don't throw - audit logging should never break the main flow
		console.error('Failed to write audit log:', error);
	}
}

/**
 * Log a login attempt
 */
export async function logLogin(
	user: User | null,
	success: boolean,
	ipAddress?: string,
	failureReason?: string
): Promise<void> {
	await logAudit(user, 'login', {
		success,
		ipAddress,
		details: failureReason ? { failureReason } : undefined
	});
}

/**
 * Log a logout
 */
export async function logLogout(user: User, ipAddress?: string): Promise<void> {
	await logAudit(user, 'logout', { ipAddress });
}

/**
 * Log resource read (list/view)
 */
export async function logResourceRead(
	user: User,
	resourceType: string,
	resourceName?: string,
	namespace?: string,
	clusterId?: string
): Promise<void> {
	await logAudit(user, 'read', {
		resourceType,
		resourceName,
		namespace,
		clusterId
	});
}

/**
 * Log resource write (create/update)
 */
export async function logResourceWrite(
	user: User,
	resourceType: string,
	action: 'suspend' | 'resume' | 'reconcile' | 'update' | 'rollback',
	resourceName: string,
	namespace: string,
	clusterId?: string,
	details?: Record<string, unknown>
): Promise<void> {
	await logAudit(user, `write:${action}`, {
		resourceType,
		resourceName,
		namespace,
		clusterId,
		details
	});
}

/**
 * Log user management action
 */
export async function logUserManagement(
	adminUser: User,
	action: 'create' | 'update' | 'delete' | 'disable',
	targetUserId: string,
	username: string,
	details?: Record<string, unknown>
): Promise<void> {
	await logAudit(adminUser, `user:${action}`, {
		resourceType: 'User',
		resourceName: username,
		details: { targetUserId, ...details }
	});
}

/**
 * Log RBAC policy change
 */
export async function logRbacChange(
	adminUser: User,
	action: 'create' | 'update' | 'delete' | 'bind' | 'unbind',
	policyName?: string,
	userId?: string,
	details?: Record<string, unknown>
): Promise<void> {
	await logAudit(adminUser, `rbac:${action}`, {
		resourceType: 'RBACPolicy',
		resourceName: policyName,
		details: { userId, ...details }
	});
}

/**
 * Log cluster configuration change
 */
export async function logClusterChange(
	user: User,
	action: 'create' | 'update' | 'delete' | 'test',
	clusterName: string,
	details?: Record<string, unknown>
): Promise<void> {
	await logAudit(user, `cluster:${action}`, {
		resourceType: 'Cluster',
		resourceName: clusterName,
		details
	});
}

/**
 * Get recent audit logs
 */
export async function getRecentAuditLogs(userId?: string, action?: string, limit: number = 100) {
	const db = getDbSync();

	// Build where conditions
	const conditions = [];

	if (userId) {
		conditions.push(eq(auditLogs.userId, userId));
	}

	if (action) {
		conditions.push(eq(auditLogs.action, action));
	}

	// Use the query helper from Drizzle
	const logs = await db.query.auditLogs.findMany({
		where: conditions.length > 0 ? and(...conditions) : undefined,
		orderBy: [desc(auditLogs.createdAt)],
		limit
	});

	return logs;
}
