import { normalizeClusterId } from '$lib/clusters/identity.js';
import { logger } from '../../logger.js';
import { getCustomObjectsApi } from '../client.js';
import type { FluxResourceType } from './resources.js';
import { getReconciliationHistory } from './reconciliation-tracker.js';
import { getResourceDef } from './resources.js';
import {
	buildRollbackPatch,
	findRollbackHistoryEntry,
	parseRollbackSnapshot
} from './rollback-helpers.js';

/**
 * Rollback a FluxCD resource to a previous state
 * This restores the spec from a historical snapshot and triggers reconciliation
 *
 * @param type - FluxCD resource type
 * @param namespace - Kubernetes namespace
 * @param name - Resource name
 * @param revisionOrHistoryId - Either a revision string or history entry ID
 * @param context - Cluster context
 * @param dryRun - If true, return the patch that would be applied without actually patching
 */
export async function rollbackResource(
	type: FluxResourceType,
	namespace: string,
	name: string,
	revisionOrHistoryId: string,
	context?: string,
	dryRun?: boolean
): Promise<{ patch: object; historyEntry: { id: string; revision: string | null } } | void> {
	const clusterId = normalizeClusterId(context);

	// 1. Fetch history entry to get spec snapshot
	const history = await getReconciliationHistory(type, namespace, name, clusterId);

	const historyEntry = findRollbackHistoryEntry(history, revisionOrHistoryId);
	const spec = parseRollbackSnapshot(historyEntry, revisionOrHistoryId);

	// 3. Get resource definition
	const resourceDef = getResourceDef(type);
	if (!resourceDef) {
		throw new Error(`Unknown resource type: ${type}`);
	}

	const patch = buildRollbackPatch(spec, historyEntry.revision);

	// 5. If dry-run, return the patch without applying it
	if (dryRun) {
		return { patch, historyEntry: { id: historyEntry.id, revision: historyEntry.revision } };
	}

	// 6. Patch the resource using merge-patch strategy
	const api = await getCustomObjectsApi(context);
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
		} as Record<string, unknown>
	);

	logger.info(
		`[Rollback] Rolled back ${type}/${namespace}/${name} to revision ${historyEntry.revision}`
	);
}
