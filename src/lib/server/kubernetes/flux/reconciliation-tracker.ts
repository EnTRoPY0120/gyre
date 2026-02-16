import { eq, and, desc, gte } from 'drizzle-orm';
import { getDbSync, type NewReconciliationHistory } from '../../db/index.js';
import { reconciliationHistory } from '../../db/schema.js';
import type { FluxResource, K8sCondition } from './types.js';
import type { FluxResourceType } from './resources.js';

/**
 * Extract revision from FluxCD resource status
 */
function getResourceRevision(resource: FluxResource): string {
	return (
		resource.status?.lastAppliedRevision ||
		resource.status?.artifact?.revision ||
		resource.status?.lastAttemptedRevision ||
		''
	);
}

/**
 * Get previous revision from resource status
 */
function getPreviousRevision(resource: FluxResource): string | null {
	// For sources (GitRepository, HelmRepository, etc.), check lastAttemptedRevision
	// For deployments (Kustomization, HelmRelease), this is the previous applied revision
	// This is best-effort - FluxCD doesn't always expose previous revision
	return resource.status?.lastAttemptedRevision || null;
}

/**
 * Determine reconciliation status from resource conditions
 */
function determineStatus(
	readyCondition: K8sCondition | undefined
): 'success' | 'failure' | 'unknown' {
	if (!readyCondition) return 'unknown';
	if (readyCondition.status === 'True') return 'success';
	if (readyCondition.status === 'False') return 'failure';
	return 'unknown';
}

/**
 * Calculate reconciliation duration from resource status
 * Returns duration in milliseconds or null if unavailable
 */
function calculateDuration(_resource: FluxResource): number | null {
	// FluxCD doesn't always expose precise timing data
	// This is a best-effort calculation based on available timestamps
	// Future: Consider adding custom annotations for precise tracking
	return null;
}

/**
 * Get reconciliation start time from resource status
 * Returns timestamp or null if unavailable
 */
function getReconcileStartTime(resource: FluxResource): Date | null {
	// Best effort: Use lastTransitionTime from Ready condition
	const readyCondition = resource.status?.conditions?.find((c) => c.type === 'Ready');
	if (readyCondition?.lastTransitionTime) {
		return new Date(readyCondition.lastTransitionTime);
	}
	return null;
}

/**
 * Get reconciliation completion time from resource status
 * Returns timestamp, defaulting to current time if unavailable
 */
function getReconcileCompletedTime(resource: FluxResource): Date {
	// Use artifact lastUpdateTime for sources
	if (resource.status?.artifact?.lastUpdateTime) {
		return new Date(resource.status.artifact.lastUpdateTime);
	}

	// Use Ready condition lastTransitionTime
	const readyCondition = resource.status?.conditions?.find((c) => c.type === 'Ready');
	if (readyCondition?.lastTransitionTime) {
		return new Date(readyCondition.lastTransitionTime);
	}

	// Fallback to current time
	return new Date();
}

/**
 * Get Stalled condition reason if resource is stalled
 */
function getStalledReason(resource: FluxResource): string | null {
	const stalledCondition = resource.status?.conditions?.find((c) => c.type === 'Stalled');
	if (stalledCondition?.status === 'True') {
		return stalledCondition.reason || 'Stalled';
	}
	return null;
}

export interface CaptureReconciliationOptions {
	resourceType: FluxResourceType;
	namespace: string;
	name: string;
	clusterId: string;
	resource: FluxResource;
	triggerType?: 'automatic' | 'manual' | 'webhook' | 'rollback';
	triggeredByUserId?: string | null;
}

/**
 * Capture a reconciliation event to the database
 * This is called whenever a FluxCD resource completes a reconciliation
 */
export async function captureReconciliation(options: CaptureReconciliationOptions): Promise<void> {
	try {
		const db = getDbSync();

		const readyCondition = options.resource.status?.conditions?.find((c) => c.type === 'Ready');
		const revision = getResourceRevision(options.resource);
		const previousRevision = getPreviousRevision(options.resource);
		const status = determineStatus(readyCondition);
		const durationMs = calculateDuration(options.resource);
		const reconcileStartedAt = getReconcileStartTime(options.resource);
		const reconcileCompletedAt = getReconcileCompletedTime(options.resource);
		const stalledReason = getStalledReason(options.resource);

		// Extract error message for failed reconciliations
		const errorMessage =
			status === 'failure' && readyCondition?.message ? readyCondition.message : null;

		// Check for duplicate entry (same revision + timestamp)
		// This prevents race conditions from creating duplicate history entries
		if (revision) {
			const existing = await db.query.reconciliationHistory.findFirst({
				where: and(
					eq(reconciliationHistory.resourceType, options.resourceType),
					eq(reconciliationHistory.namespace, options.namespace),
					eq(reconciliationHistory.name, options.name),
					eq(reconciliationHistory.clusterId, options.clusterId),
					eq(reconciliationHistory.revision, revision),
					eq(reconciliationHistory.reconcileCompletedAt, reconcileCompletedAt)
				)
			});

			if (existing) {
				// Already captured this reconciliation
				return;
			}
		}

		const entry: NewReconciliationHistory = {
			id: crypto.randomUUID(),
			resourceType: options.resourceType,
			namespace: options.namespace,
			name: options.name,
			clusterId: options.clusterId,
			revision: revision || null,
			previousRevision: previousRevision,
			status,
			readyStatus: readyCondition?.status || null,
			readyReason: readyCondition?.reason || null,
			readyMessage: readyCondition?.message || null,
			reconcileStartedAt: reconcileStartedAt,
			reconcileCompletedAt: reconcileCompletedAt,
			durationMs: durationMs,
			specSnapshot: options.resource.spec ? JSON.stringify(options.resource.spec) : null,
			metadataSnapshot: JSON.stringify({
				labels: options.resource.metadata.labels || {},
				annotations: options.resource.metadata.annotations || {}
			}),
			triggerType: options.triggerType || 'automatic',
			triggeredByUser: options.triggeredByUserId || null,
			errorMessage: errorMessage,
			stalledReason: stalledReason
		};

		await db.insert(reconciliationHistory).values(entry);
	} catch (error) {
		// Don't throw - history capture should never break the main flow
		console.error('[ReconciliationTracker] Failed to capture reconciliation:', error);
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

	// Build where conditions
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

/**
 * Get the most recent reconciliation for a resource
 */
export async function getLatestReconciliation(
	resourceType: FluxResourceType,
	namespace: string,
	name: string,
	clusterId: string = 'in-cluster'
): Promise<typeof reconciliationHistory.$inferSelect | null> {
	const db = getDbSync();

	const latest = await db.query.reconciliationHistory.findFirst({
		where: and(
			eq(reconciliationHistory.resourceType, resourceType),
			eq(reconciliationHistory.namespace, namespace),
			eq(reconciliationHistory.name, name),
			eq(reconciliationHistory.clusterId, clusterId)
		),
		orderBy: [desc(reconciliationHistory.reconcileCompletedAt)]
	});

	return latest || null;
}
