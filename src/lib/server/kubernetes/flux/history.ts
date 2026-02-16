import { getCustomObjectsApi } from '../client.js';
import type { FluxResourceType } from './resources.js';
import { getReconciliationHistory } from './reconciliation-tracker.js';
import { getResourceDef } from './resources.js';

export interface ResourceRevision {
	revision: string;
	timestamp: string;
	status: string;
	message?: string;
}

/**
 * Get history for a Flux resource
 * Now uses the unified reconciliation_history table for all FluxCD resources
 */
export async function getResourceHistory(
	type: FluxResourceType,
	namespace: string,
	name: string,
	context?: string
): Promise<ResourceRevision[]> {
	// Use the new reconciliation history system for all resources
	const clusterId = context || 'in-cluster';
	const history = await getReconciliationHistory(type, namespace, name, clusterId);

	// Transform to the expected format for backward compatibility
	return history.map((entry) => ({
		revision: entry.revision || 'unknown',
		timestamp: entry.reconcileCompletedAt?.toISOString() || new Date().toISOString(),
		status: entry.status,
		message: entry.readyMessage || entry.errorMessage || undefined
	}));
}

/**
 * Rollback a FluxCD resource to a previous state
 * This restores the spec from a historical snapshot and triggers reconciliation
 *
 * @param type - FluxCD resource type
 * @param namespace - Kubernetes namespace
 * @param name - Resource name
 * @param revisionOrHistoryId - Either a revision string or history entry ID
 * @param context - Cluster context
 */
export async function rollbackResource(
	type: FluxResourceType,
	namespace: string,
	name: string,
	revisionOrHistoryId: string,
	context?: string
): Promise<void> {
	const clusterId = context || 'in-cluster';

	// 1. Fetch history entry to get spec snapshot
	const history = await getReconciliationHistory(type, namespace, name, clusterId);

	// Find the history entry by revision or ID
	const historyEntry = history.find(
		(entry) => entry.id === revisionOrHistoryId || entry.revision === revisionOrHistoryId
	);

	if (!historyEntry) {
		throw new Error(
			`No history entry found for revision/ID: ${revisionOrHistoryId}. Cannot rollback.`
		);
	}

	if (!historyEntry.specSnapshot) {
		throw new Error(`History entry ${revisionOrHistoryId} has no spec snapshot. Cannot rollback.`);
	}

	// 2. Parse the spec snapshot
	let spec;
	try {
		spec = JSON.parse(historyEntry.specSnapshot);
	} catch (error) {
		console.error(
			`[Rollback] Failed to parse spec snapshot for history entry ${historyEntry.id}:`,
			error
		);
		throw new Error(
			`Invalid spec snapshot in history entry ${revisionOrHistoryId}. Cannot rollback.`
		);
	}

	// 3. Get resource definition and API client
	const resourceDef = getResourceDef(type);
	if (!resourceDef) {
		throw new Error(`Unknown resource type: ${type}`);
	}

	const api = await getCustomObjectsApi(context);

	// 4. Prepare the patch: update spec and add reconciliation annotation
	const now = new Date().toISOString();
	const patch = {
		spec,
		metadata: {
			annotations: {
				'reconcile.fluxcd.io/requestedAt': now,
				'gyre.io/rolledBackFrom': historyEntry.revision || 'unknown',
				'gyre.io/rolledBackAt': now
			}
		}
	};

	// 5. Patch the resource using merge-patch strategy
	await api.patchNamespacedCustomObject(
		{
			group: resourceDef.group,
			version: resourceDef.version,
			namespace,
			plural: resourceDef.plural,
			name,
			body: patch
		},
		{
			headers: { 'Content-Type': 'application/merge-patch+json' }
		} as any
	);

	console.log(
		`[Rollback] Rolled back ${type}/${namespace}/${name} to revision ${historyEntry.revision}`
	);
}
