import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { FluxResource } from '../lib/server/kubernetes/flux/types.js';
import { importFresh } from './helpers/import-fresh';

type TrackerModule = typeof import('../lib/server/kubernetes/flux/reconciliation-tracker.js');

const insertValues = vi.fn();
const findFirst = vi.fn();
const loggerError = vi.fn();

const db = {
	query: { reconciliationHistory: { findFirst } },
	insert: vi.fn(() => ({ values: insertValues }))
};

let captureReconciliation: TrackerModule['captureReconciliation'];

function makeResource(overrides: Partial<FluxResource> = {}): FluxResource {
	return {
		apiVersion: 'source.toolkit.fluxcd.io/v1',
		kind: 'GitRepository',
		metadata: {
			name: 'app',
			namespace: 'flux-system',
			labels: { team: 'platform' },
			annotations: { owner: 'sre' }
		},
		spec: { interval: '5m' },
		status: {
			lastAppliedRevision: 'rev-2',
			lastAttemptedRevision: 'rev-1',
			conditions: [
				{
					type: 'Ready',
					status: 'True',
					reason: 'Reconciled',
					message: 'Applied revision',
					lastTransitionTime: '2026-01-01T00:00:00.000Z'
				}
			],
			artifact: {
				path: 'artifact.tar.gz',
				url: 'https://example.test/artifact.tar.gz',
				revision: 'rev-2',
				lastUpdateTime: '2026-01-01T00:00:05.000Z'
			}
		},
		...overrides
	};
}

function captureOptions(resource?: FluxResource) {
	return {
		resourceType: 'GitRepository' as const,
		namespace: 'flux-system',
		name: 'app',
		clusterId: 'cluster-1',
		resource,
		triggerType: 'automatic' as const
	};
}

beforeEach(async () => {
	insertValues.mockReset();
	findFirst.mockReset().mockResolvedValue(null);
	db.insert.mockClear();
	loggerError.mockReset();

	vi.doMock('../lib/server/db/index.js', () => ({ getDbSync: () => db }));
	vi.doMock('../lib/server/logger.js', () => ({
		logger: { error: loggerError }
	}));

	({ captureReconciliation } = await importFresh<TrackerModule>(
		'../lib/server/kubernetes/flux/reconciliation-tracker.js'
	));
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.resetModules();
});

describe('captureReconciliation', () => {
	test('persists outcome fields, snapshots, and calculated duration', async () => {
		await captureReconciliation(captureOptions(makeResource()));

		expect(insertValues).toHaveBeenCalledOnce();
		const entry = insertValues.mock.calls[0][0];
		expect(entry).toMatchObject({
			resourceType: 'GitRepository',
			namespace: 'flux-system',
			name: 'app',
			clusterId: 'cluster-1',
			revision: 'rev-2',
			previousRevision: 'rev-1',
			status: 'success',
			readyStatus: 'True',
			readyReason: 'Reconciled',
			readyMessage: 'Applied revision',
			durationMs: 5000,
			triggerType: 'automatic'
		});
		expect(JSON.parse(entry.specSnapshot)).toEqual({ interval: '5m' });
		expect(JSON.parse(entry.metadataSnapshot)).toEqual({
			labels: { team: 'platform' },
			annotations: { owner: 'sre' }
		});
	});

	test('skips duplicate outcome entries by revision, status, and reason', async () => {
		findFirst.mockResolvedValue({ id: 'existing' });

		await captureReconciliation(captureOptions(makeResource()));

		expect(findFirst).toHaveBeenCalledOnce();
		expect(insertValues).not.toHaveBeenCalled();
	});

	test('persists trigger-only entries without stale resource state', async () => {
		await captureReconciliation({
			...captureOptions(),
			resource: undefined,
			triggerType: 'manual',
			triggeredByUserId: 'user-1'
		});

		const entry = insertValues.mock.calls[0][0];
		expect(entry).toMatchObject({
			revision: null,
			previousRevision: null,
			status: 'unknown',
			readyStatus: null,
			reconcileStartedAt: null,
			durationMs: null,
			specSnapshot: null,
			metadataSnapshot: null,
			triggerType: 'manual',
			triggeredByUser: 'user-1',
			errorMessage: null,
			stalledReason: null
		});
		expect(entry.reconcileCompletedAt).toBeInstanceOf(Date);
	});

	test('swallows database failures and logs the capture error', async () => {
		insertValues.mockRejectedValue(new Error('database unavailable'));

		await expect(captureReconciliation(captureOptions(makeResource()))).resolves.toBeUndefined();
		expect(loggerError).toHaveBeenCalledWith(
			expect.any(Error),
			'[ReconciliationTracker] Failed to capture reconciliation'
		);
	});
});
