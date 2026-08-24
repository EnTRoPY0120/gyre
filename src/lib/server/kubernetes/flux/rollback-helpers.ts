import { logger } from '../../logger.js';

export interface RollbackHistoryEntry {
	id: string;
	revision: string | null;
	specSnapshot: string | null;
}

export interface RollbackPatch {
	spec: unknown;
	metadata: {
		annotations: {
			'reconcile.fluxcd.io/requestedAt': string;
			'gyre.io/rolledBackFrom': string;
			'gyre.io/rolledBackAt': string;
		};
	};
}

export function findRollbackHistoryEntry(
	history: readonly RollbackHistoryEntry[],
	revisionOrHistoryId: string
): RollbackHistoryEntry {
	const historyEntry = history.find(
		(entry) => entry.id === revisionOrHistoryId || entry.revision === revisionOrHistoryId
	);

	if (!historyEntry) {
		throw new Error(
			`No history entry found for revision/ID: ${revisionOrHistoryId}. Cannot rollback.`
		);
	}

	return historyEntry;
}

export function parseRollbackSnapshot(
	historyEntry: RollbackHistoryEntry,
	revisionOrHistoryId: string
): unknown {
	if (!historyEntry.specSnapshot) {
		throw new Error(`History entry ${revisionOrHistoryId} has no spec snapshot. Cannot rollback.`);
	}

	try {
		return JSON.parse(historyEntry.specSnapshot);
	} catch (error) {
		logger.error(
			error,
			`[Rollback] Failed to parse spec snapshot for history entry ${historyEntry.id}`
		);
		throw new Error(
			`Invalid spec snapshot in history entry ${revisionOrHistoryId}. Cannot rollback.`
		);
	}
}

export function buildRollbackPatch(
	spec: unknown,
	revision: string | null,
	now = new Date().toISOString()
): RollbackPatch {
	return {
		spec,
		metadata: {
			annotations: {
				'reconcile.fluxcd.io/requestedAt': now,
				'gyre.io/rolledBackFrom': revision || 'unknown',
				'gyre.io/rolledBackAt': now
			}
		}
	};
}
