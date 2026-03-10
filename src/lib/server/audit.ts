import { eq, desc, and, lt, sql } from 'drizzle-orm';
import { getDbSync, type NewAuditLog } from './db/index.js';
import { auditLogs } from './db/schema.js';
import type { User } from './db/schema.js';
import { getAuditLogRetentionDays } from './settings.js';
import {
	MS_PER_DAY,
	INITIAL_CLEANUP_DELAY_MS,
	getCutoffDate,
	getRandomJitterMs
} from './utils/time.js';

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
export async function getRecentAuditLogs(
	userId?: string,
	action?: string,
	limit: number = 100,
	includeUser: boolean = true
) {
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
		with: includeUser ? { user: true } : undefined,
		orderBy: [desc(auditLogs.createdAt)],
		limit
	});

	return logs;
}

/**
 * Clean up old audit logs based on retention policy
 */
export async function cleanupOldAuditLogs(): Promise<number> {
	try {
		const db = getDbSync();
		const retentionDays = await getAuditLogRetentionDays();

		// Calculate cutoff date: items older than this will be deleted
		const cutoff = getCutoffDate(retentionDays);

		// First, get the count of items to be deleted (for logging)
		const countResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(auditLogs)
			.where(lt(auditLogs.createdAt, cutoff));

		const toDeleteCount = countResult[0]?.count || 0;

		if (toDeleteCount > 0) {
			// Delete items older than cutoff. We don't use .returning() to avoid memory issues with large datasets.
			await db.delete(auditLogs).where(lt(auditLogs.createdAt, cutoff));

			console.log(
				`[AuditCleanup] Successfully deleted ${toDeleteCount} audit logs older than ${retentionDays} days (before ${cutoff.toISOString()})`
			);
		}

		return toDeleteCount;
	} catch (error) {
		console.error('[AuditCleanup] Failed to clean up audit logs:', error);
		return 0;
	}
}

// Scheduler constants
const CLEANUP_HOUR = 3; // 3 AM

let cleanupScheduled = false;
let cleanupInterval: NodeJS.Timeout | null = null;
let initialDelayTimeout: NodeJS.Timeout | null = null;
let immediateCleanupTimeout: NodeJS.Timeout | null = null;

/**
 * Schedule periodic cleanup of audit logs
 * Runs daily at 3 AM local server time
 */
export function scheduleAuditLogCleanup(): void {
	if (cleanupScheduled) {
		return;
	}

	// Calculate initial delay to run at the specified hour (e.g., 3 AM)
	const now = new Date();
	const nextRun = new Date();
	nextRun.setHours(CLEANUP_HOUR, 0, 0, 0);

	// If the time has already passed today, schedule for tomorrow
	if (nextRun <= now) {
		nextRun.setDate(nextRun.getDate() + 1);
	}

	const initialDelay = nextRun.getTime() - now.getTime();

	console.log(
		`[AuditCleanup] Scheduling daily audit log cleanup to run at ${nextRun.toISOString()} (in ${Math.round(initialDelay / 1000 / 60)} minutes)`
	);

	// Run initial cleanup after the calculated delay to align with the daily schedule
	initialDelayTimeout = setTimeout(() => {
		cleanupOldAuditLogs().catch((err) => {
			console.error('[AuditCleanup] Scheduled cleanup failed:', err);
		});

		// Then run every 24 hours
		cleanupInterval = setInterval(() => {
			cleanupOldAuditLogs().catch((err) => {
				console.error('[AuditCleanup] Periodic cleanup failed:', err);
			});
		}, MS_PER_DAY);
	}, initialDelay);

	// Also run an initial cleanup shortly after startup
	// This ensures that even if the server is restarted frequently, old logs are still pruned
	// and provides immediate feedback during development or after configuration changes.
	// We add a random jitter (0-30m) to INITIAL_CLEANUP_DELAY_MS to prevent multiple instances from contending.
	const startupDelayWithJitter = INITIAL_CLEANUP_DELAY_MS + getRandomJitterMs(30);

	immediateCleanupTimeout = setTimeout(() => {
		console.log('[AuditCleanup] Running startup cleanup task...');
		cleanupOldAuditLogs().catch((err) => {
			console.error('[AuditCleanup] Startup cleanup task failed:', err);
		});
	}, startupDelayWithJitter);

	cleanupScheduled = true;
}

/**
 * Stop the audit log cleanup scheduler
 */
export function stopAuditLogCleanup(): void {
	if (cleanupInterval) {
		clearInterval(cleanupInterval);
		cleanupInterval = null;
	}
	if (initialDelayTimeout) {
		clearTimeout(initialDelayTimeout);
		initialDelayTimeout = null;
	}
	if (immediateCleanupTimeout) {
		clearTimeout(immediateCleanupTimeout);
		immediateCleanupTimeout = null;
	}
	cleanupScheduled = false;
}
