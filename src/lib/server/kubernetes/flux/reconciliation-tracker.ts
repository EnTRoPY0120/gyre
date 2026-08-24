import { and, desc, eq, gte, isNull } from 'drizzle-orm';
import { logger } from '../../logger.js';
import { getDbSync, type NewReconciliationHistory } from '../../db/index.js';
import { reconciliationHistory } from '../../db/schema.js';
import { buildOutcomeEntry, buildTriggerEntry } from './reconciliation-entry.js';
import type { CaptureReconciliationOptions } from './reconciliation-entry.js';
import type { FluxResourceType } from './resources.js';

export type { CaptureReconciliationOptions } from './reconciliation-entry.js';

type ReconciliationDb = ReturnType<typeof getDbSync>;

async function isDuplicateOutcome(
	db: ReconciliationDb,
	options: CaptureReconciliationOptions,
	entry: NewReconciliationHistory
): Promise<boolean> {
	if (!entry.revision || !options.resource) return false;

	const readyReasonCondition = entry.readyReason
		? eq(reconciliationHistory.readyReason, entry.readyReason)
		: isNull(reconciliationHistory.readyReason);

	const existing = await db.query.reconciliationHistory.findFirst({
		where: and(
			eq(reconciliationHistory.resourceType, options.resourceType),
			eq(reconciliationHistory.namespace, options.namespace),
			eq(reconciliationHistory.name, options.name),
			eq(reconciliationHistory.clusterId, options.clusterId),
			eq(reconciliationHistory.revision, entry.revision),
			eq(reconciliationHistory.status, entry.status),
			readyReasonCondition
		)
	});

	return Boolean(existing);
}

/**
 * Capture a reconciliation event to the database.
 * Called either when a FluxCD resource completes a reconciliation (resource
 * provided) or when a reconciliation is manually triggered (no resource) to
 * record the trigger event without stale status/revision data.
 */
export async function captureReconciliation(options: CaptureReconciliationOptions): Promise<void> {
	try {
		const db = getDbSync();
		const entry = options.resource
			? buildOutcomeEntry({ ...options, resource: options.resource })
			: buildTriggerEntry(options);

		if (await isDuplicateOutcome(db, options, entry)) return;
		await db.insert(reconciliationHistory).values(entry);
	} catch (error) {
		// Don't throw - history capture should never break the main flow
		logger.error(error, '[ReconciliationTracker] Failed to capture reconciliation');
	}
}

export interface GetReconciliationHistoryOptions {
	limit?: number;
	status?: 'success' | 'failure' | 'unknown';
	since?: Date;
}

/**
 * Get reconciliation history for a specific resource
 * @param resourceType - FluxCD resource type (e.g., 'GitRepository')
 * @param namespace - Kubernetes namespace
 * @param name - Resource name
 * @param clusterId - Cluster identifier
 * @param options - Query filters
 * @returns Array of reconciliation history entries
 */
export async function getReconciliationHistory(
	resourceType: FluxResourceType,
	namespace: string,
	name: string,
	clusterId: string = 'in-cluster',
	options: GetReconciliationHistoryOptions = {}
): Promise<(typeof reconciliationHistory.$inferSelect)[]> {
	const db = getDbSync();

	const conditions = [
		eq(reconciliationHistory.resourceType, resourceType),
		eq(reconciliationHistory.namespace, namespace),
		eq(reconciliationHistory.name, name),
		eq(reconciliationHistory.clusterId, clusterId)
	];

	if (options.status) {
		conditions.push(eq(reconciliationHistory.status, options.status));
	}

	if (options.since) {
		conditions.push(gte(reconciliationHistory.reconcileCompletedAt, options.since));
	}

	const history = await db.query.reconciliationHistory.findMany({
		where: and(...conditions),
		orderBy: [desc(reconciliationHistory.reconcileCompletedAt)],
		limit: options.limit || 100
	});

	return history;
}
