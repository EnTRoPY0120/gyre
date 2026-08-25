import { describe, expect, test } from 'vitest';
import {
	buildRollbackPatch,
	findRollbackHistoryEntry,
	parseRollbackSnapshot,
	type RollbackHistoryEntry
} from '../lib/server/kubernetes/flux/rollback-helpers.js';

function historyEntry(overrides: Partial<RollbackHistoryEntry> = {}): RollbackHistoryEntry {
	return {
		id: 'history-1',
		revision: 'main@sha1:abc',
		specSnapshot: JSON.stringify({ path: './apps' }),
		...overrides
	};
}

describe('Flux rollback helpers', () => {
	test('finds a history entry by ID or revision', () => {
		const entry = historyEntry();

		expect(findRollbackHistoryEntry([entry], 'history-1')).toBe(entry);
		expect(findRollbackHistoryEntry([entry], 'main@sha1:abc')).toBe(entry);
	});

	test('reports missing history entries and snapshots', () => {
		expect(() => findRollbackHistoryEntry([], 'missing')).toThrow(
			'No history entry found for revision/ID: missing. Cannot rollback.'
		);
		expect(() => parseRollbackSnapshot(historyEntry({ specSnapshot: null }), 'history-1')).toThrow(
			'History entry history-1 has no spec snapshot. Cannot rollback.'
		);
	});

	test('parses valid snapshots and reports invalid JSON', () => {
		expect(parseRollbackSnapshot(historyEntry(), 'history-1')).toEqual({ path: './apps' });
		expect(() =>
			parseRollbackSnapshot(historyEntry({ specSnapshot: '{invalid' }), 'history-1')
		).toThrow('Invalid spec snapshot in history entry history-1. Cannot rollback.');
	});

	test('builds a merge patch with rollback annotations', () => {
		expect(
			buildRollbackPatch({ path: './apps' }, 'main@sha1:abc', '2024-01-01T00:00:00.000Z')
		).toEqual({
			spec: { path: './apps' },
			metadata: {
				annotations: {
					'reconcile.fluxcd.io/requestedAt': '2024-01-01T00:00:00.000Z',
					'gyre.io/rolledBackFrom': 'main@sha1:abc',
					'gyre.io/rolledBackAt': '2024-01-01T00:00:00.000Z'
				}
			}
		});
	});
});
