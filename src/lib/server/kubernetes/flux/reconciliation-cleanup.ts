import { sql, and, eq, lt, desc } from 'drizzle-orm';
import { getDbSync } from '../../db/index.js';
import { reconciliationHistory } from '../../db/schema.js';

export interface CleanupStats {
	deletedSuccess: number;
	deletedFailure: number;
	totalDeleted: number;
	perResourceTrimmed: number;
}

/**
 * Cleanup policies:
 * - Delete successful entries older than 90 days
 * - Delete failed entries older than 365 days
 * - Keep last 100 entries per resource (regardless of age)
 */
const CLEANUP_POLICIES = {
	successRetentionDays: 90,
	failureRetentionDays: 365,
	maxEntriesPerResource: 100
};

/**
 * Clean up old reconciliation history entries
 * @returns Statistics about the cleanup operation
 */
export async function cleanupReconciliationHistory(): Promise<CleanupStats> {
	const db = getDbSync();
	const stats: CleanupStats = {
		deletedSuccess: 0,
		deletedFailure: 0,
		totalDeleted: 0,
		perResourceTrimmed: 0
	};

	try {
		// Calculate cutoff dates
		const now = new Date();
		const successCutoff = new Date(now);
		successCutoff.setDate(successCutoff.getDate() - CLEANUP_POLICIES.successRetentionDays);

		const failureCutoff = new Date(now);
		failureCutoff.setDate(failureCutoff.getDate() - CLEANUP_POLICIES.failureRetentionDays);

		// 1. Delete old successful entries
		const deletedSuccessResult = await db
			.delete(reconciliationHistory)
			.where(
				and(
					eq(reconciliationHistory.status, 'success'),
					lt(reconciliationHistory.reconcileCompletedAt, successCutoff)
				)
			)
			.returning({ id: reconciliationHistory.id });

		stats.deletedSuccess = deletedSuccessResult.length;

		// 2. Delete old failed entries
		const deletedFailureResult = await db
			.delete(reconciliationHistory)
			.where(
				and(
					eq(reconciliationHistory.status, 'failure'),
					lt(reconciliationHistory.reconcileCompletedAt, failureCutoff)
				)
			)
			.returning({ id: reconciliationHistory.id });

		stats.deletedFailure = deletedFailureResult.length;

		// 3. Keep only last N entries per resource
		// Get all unique resource combinations
		const uniqueResources = await db
			.selectDistinct({
				resourceType: reconciliationHistory.resourceType,
				namespace: reconciliationHistory.namespace,
				name: reconciliationHistory.name,
				clusterId: reconciliationHistory.clusterId
			})
			.from(reconciliationHistory);

		// For each resource, keep only the last N entries
		for (const resource of uniqueResources) {
			const allEntries = await db.query.reconciliationHistory.findMany({
				where: and(
					eq(reconciliationHistory.resourceType, resource.resourceType),
					eq(reconciliationHistory.namespace, resource.namespace),
					eq(reconciliationHistory.name, resource.name),
					eq(reconciliationHistory.clusterId, resource.clusterId)
				),
				orderBy: [desc(reconciliationHistory.reconcileCompletedAt)],
				columns: { id: true }
			});

			// If more than maxEntriesPerResource, delete the excess
			if (allEntries.length > CLEANUP_POLICIES.maxEntriesPerResource) {
				const entriesToDelete = allEntries.slice(CLEANUP_POLICIES.maxEntriesPerResource);
				const idsToDelete = entriesToDelete.map((e) => e.id);

				if (idsToDelete.length > 0) {
					// Delete in batches to avoid SQL query limits
					const batchSize = 100;
					for (let i = 0; i < idsToDelete.length; i += batchSize) {
						const batch = idsToDelete.slice(i, i + batchSize);
						await db
							.delete(reconciliationHistory)
							.where(
								sql`${reconciliationHistory.id} IN (${sql.join(batch.map((id) => sql`${id}`), sql`, `)})`
							);
					}

					stats.perResourceTrimmed += idsToDelete.length;
				}
			}
		}

		stats.totalDeleted =
			stats.deletedSuccess + stats.deletedFailure + stats.perResourceTrimmed;

		console.log(
			`[ReconciliationCleanup] Cleanup completed:`,
			`deleted ${stats.deletedSuccess} old success entries,`,
			`${stats.deletedFailure} old failure entries,`,
			`and trimmed ${stats.perResourceTrimmed} excess entries.`,
			`Total: ${stats.totalDeleted} deleted.`
		);

		return stats;
	} catch (error) {
		console.error('[ReconciliationCleanup] Cleanup failed:', error);
		throw error;
	}
}

let cleanupScheduled = false;
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Schedule periodic cleanup of reconciliation history
 * Runs daily at 2 AM local server time
 */
export function scheduleCleanup(): void {
	if (cleanupScheduled) {
		console.log('[ReconciliationCleanup] Cleanup already scheduled, skipping');
		return;
	}

	// Run cleanup daily (24 hours)
	const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

	// Calculate initial delay to run at 2 AM
	const now = new Date();
	const nextRun = new Date();
	nextRun.setHours(2, 0, 0, 0);

	// If 2 AM has already passed today, schedule for tomorrow
	if (nextRun <= now) {
		nextRun.setDate(nextRun.getDate() + 1);
	}

	const initialDelay = nextRun.getTime() - now.getTime();

	console.log(
		`[ReconciliationCleanup] Scheduling cleanup to run at ${nextRun.toISOString()} (in ${Math.round(initialDelay / 1000 / 60)} minutes)`
	);

	// Run initial cleanup after delay
	setTimeout(() => {
		cleanupReconciliationHistory().catch((err) => {
			console.error('[ReconciliationCleanup] Initial cleanup failed:', err);
		});

		// Then run every 24 hours
		cleanupInterval = setInterval(() => {
			cleanupReconciliationHistory().catch((err) => {
				console.error('[ReconciliationCleanup] Scheduled cleanup failed:', err);
			});
		}, CLEANUP_INTERVAL_MS);
	}, initialDelay);

	cleanupScheduled = true;

	// Also run an initial cleanup after 5 minutes for immediate effect
	setTimeout(() => {
		console.log('[ReconciliationCleanup] Running initial cleanup...');
		cleanupReconciliationHistory().catch((err) => {
			console.error('[ReconciliationCleanup] Initial cleanup failed:', err);
		});
	}, 5 * 60 * 1000);
}

/**
 * Stop the cleanup scheduler (useful for testing or graceful shutdown)
 */
export function stopCleanup(): void {
	if (cleanupInterval) {
		clearInterval(cleanupInterval);
		cleanupInterval = null;
		cleanupScheduled = false;
		console.log('[ReconciliationCleanup] Cleanup scheduler stopped');
	}
}
