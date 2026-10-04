import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import * as actualClient from '../lib/server/kubernetes/client.js';
import * as actualConstants from '../lib/server/config/constants.js';
import * as actualMetrics from '../lib/server/metrics.js';
import { getAllResourceTypes } from '../lib/server/kubernetes/flux/resources.js';
import { importFresh } from './helpers/import-fresh';

// Suppress console noise - must be before imports
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock listFluxResources to control what resources are returned
let mockResources: any[] = [];
let mockListFluxResources: (resourceType: string, clusterId?: string) => Promise<any>;
let listCalls: Array<{ resourceType: string; clusterId?: string }> = [];
type EventsModule = typeof import('../lib/server/events.js');
import type { SSEEvent } from '../lib/server/events.js';
let subscribe: EventsModule['subscribe'];
let mockCaptureReconciliation: ReturnType<typeof vi.fn>;
let pollMetricIncrements: Array<{ clusterId: string; resourceType: string; status: string }>;
let throwOnStatusGaugeSet = false;

function applyEventMocks(opts: { settlingPeriodMs: number; gaugeThrows?: boolean }) {
	throwOnStatusGaugeSet = opts.gaugeThrows ?? false;
	vi.doMock('../lib/server/kubernetes/client.js', () => ({
		...actualClient,
		listFluxResources: (resourceType: string, clusterId?: string) =>
			mockListFluxResources(resourceType, clusterId)
	}));
	vi.doMock('../lib/server/metrics.js', () => ({
		...actualMetrics,
		resourcePollsTotal: {
			labels: (clusterId: string, resourceType: string, status: string) => ({
				inc: () => pollMetricIncrements.push({ clusterId, resourceType, status })
			})
		},
		resourceUpdatesTotal: { labels: () => ({ inc: () => {} }) },
		sseSubscribersGauge: { labels: () => ({ set: () => {} }), reset: () => {} },
		activeWorkersGauge: { set: () => {} },
		fluxResourceStatusGauge: {
			labels: () => ({
				set: () => {
					if (throwOnStatusGaugeSet) throw new Error('status gauge unavailable');
				}
			}),
			remove: () => {}
		}
	}));
	vi.doMock('../lib/server/kubernetes/flux/reconciliation-tracker.js', () => ({
		captureReconciliation: mockCaptureReconciliation
	}));
	vi.doMock('../lib/server/config/constants.js', () => ({
		...actualConstants,
		SETTLING_PERIOD_MS: opts.settlingPeriodMs,
		POLL_INTERVAL_MS: 50,
		HEARTBEAT_INTERVAL_MS: 10000
	}));
	vi.doMock('../lib/server/logger.js', () => ({
		logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} }
	}));
}

beforeEach(async () => {
	mockResources = [];
	listCalls = [];
	mockListFluxResources = async (resourceType, clusterId) => {
		listCalls.push({ resourceType, clusterId });
		return { items: mockResources };
	};
	mockCaptureReconciliation = vi.fn(async () => {});
	pollMetricIncrements = [];
	applyEventMocks({ settlingPeriodMs: -1 });
	const eventsModule = await importFresh<EventsModule>('../lib/server/events.js');
	subscribe = eventsModule.subscribe;
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.resetModules();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResource(
	name: string,
	namespace: string,
	resourceVersion: string,
	readyStatus = 'True',
	revision = 'rev-1'
) {
	return {
		metadata: { name, namespace, resourceVersion, generation: 1, uid: 'test-uid' },
		status: {
			observedGeneration: 1,
			conditions: [
				{ type: 'Ready', status: readyStatus, reason: 'Reconciled', message: 'Applied revision' }
			],
			lastAppliedRevision: revision
		}
	};
}

function wait(ms: number) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// Unique cluster ID generator to isolate each test's worker
let testCounter = 0;
function uniqueClusterId(label: string) {
	return `test-${label}-${++testCounter}-${Date.now()}`;
}

// ---------------------------------------------------------------------------
// subscribe() - basic behavior
// ---------------------------------------------------------------------------
// Each test calls unsub() to stop the worker cleanly.
// ---------------------------------------------------------------------------

describe('subscribe()', () => {
	test('subscriber receives CONNECTED event immediately on subscribe', () => {
		const events: SSEEvent[] = [];
		const clusterId = uniqueClusterId('connected');
		const unsub = subscribe((e) => events.push(e), clusterId);
		try {
			expect(events).toHaveLength(1);
			expect(events[0].type).toBe('CONNECTED');
			expect(events[0].clusterId).toBe(clusterId);
		} finally {
			unsub();
		}
	});

	test('worker starts when first subscriber subscribes (poll runs and delivers events)', async () => {
		const events: SSEEvent[] = [];
		const clusterId = uniqueClusterId('worker-start');
		mockResources = [makeResource('my-app', 'flux-system', 'v1')];

		const unsub = subscribe((e) => events.push(e), clusterId);
		try {
			// Wait for at least one poll cycle to run
			await wait(150);
			// CONNECTED is sent synchronously; ADDED comes from the poll worker
			expect(events.some((e) => e.type === 'CONNECTED')).toBe(true);
			expect(events.some((e) => e.type === 'ADDED')).toBe(true);
		} finally {
			unsub();
		}
	});

	test('unsubscribe function returned; calling it removes subscriber', async () => {
		const events: SSEEvent[] = [];
		const clusterId = uniqueClusterId('unsub');
		mockResources = [];

		const unsub = subscribe((e) => events.push(e), clusterId);
		// CONNECTED arrives synchronously
		expect(events).toHaveLength(1);

		// Unsubscribe before the poll delivers any more events
		unsub();

		// Add resources and wait — should receive no further events
		mockResources = [makeResource('my-app', 'flux-system', 'v1')];
		await wait(150);

		// Still only the 1 CONNECTED event from before the unsubscribe
		expect(events).toHaveLength(1);
	});

	test('worker stops when last subscriber unsubscribes', async () => {
		const events: SSEEvent[] = [];
		const clusterId = uniqueClusterId('worker-stop');
		mockResources = [];

		const unsub = subscribe((e) => events.push(e), clusterId);
		await wait(100);
		const countBeforeUnsub = events.length;

		// Unsubscribe — this is the last (and only) subscriber
		unsub();

		// Resources appear, but worker should be stopped
		mockResources = [makeResource('my-app', 'flux-system', 'v1')];
		await wait(150);

		// No new events should have arrived after unsubscribe
		expect(events.length).toBe(countBeforeUnsub);
	});

	test('multiple subscribers all receive broadcast events', async () => {
		const events1: SSEEvent[] = [];
		const events2: SSEEvent[] = [];
		const clusterId = uniqueClusterId('multi');
		mockResources = [];

		const unsub1 = subscribe((e) => events1.push(e), clusterId);
		const unsub2 = subscribe((e) => events2.push(e), clusterId);

		// Set resources and wait for poll
		mockResources = [makeResource('my-app', 'flux-system', 'v1')];
		await wait(150);

		try {
			// Both received CONNECTED synchronously
			expect(events1[0].type).toBe('CONNECTED');
			expect(events2[0].type).toBe('CONNECTED');

			// Both should have received the same number of ADDED events
			const addedIn1 = events1.filter((e) => e.type === 'ADDED').length;
			const addedIn2 = events2.filter((e) => e.type === 'ADDED').length;
			expect(addedIn1).toBe(addedIn2);
			expect(addedIn1).toBeGreaterThan(0);
		} finally {
			unsub1();
			unsub2();
		}
	});
});

// ---------------------------------------------------------------------------
// Poll change detection
// ---------------------------------------------------------------------------

describe('Poll change detection', () => {
	test('resource processing rejection increments poll error metric', async () => {
		const events: SSEEvent[] = [];
		const clusterId = uniqueClusterId('processing-error');
		throwOnStatusGaugeSet = true;
		mockResources = [makeResource('my-app', 'flux-system', 'v1')];

		const unsub = subscribe((e) => events.push(e), clusterId);
		await wait(150);

		try {
			expect(
				pollMetricIncrements.some(
					(metric) =>
						metric.clusterId === clusterId &&
						metric.resourceType === 'GitRepository' &&
						metric.status === 'error'
				)
			).toBe(true);
			expect(
				pollMetricIncrements.some(
					(metric) =>
						metric.clusterId === clusterId &&
						metric.resourceType === 'GitRepository' &&
						metric.status === 'success'
				)
			).toBe(false);
		} finally {
			unsub();
		}
	});

	test('resource with changed resourceVersion broadcasts MODIFIED event', async () => {
		const events: SSEEvent[] = [];
		const clusterId = uniqueClusterId('modified');

		// Start with resource at v1
		mockResources = [makeResource('my-app', 'flux-system', 'v1')];
		const unsub = subscribe((e) => events.push(e), clusterId);

		// Wait for first poll to record the resource in lastStates
		await wait(150);

		// Update resourceVersion and revision
		mockResources = [makeResource('my-app', 'flux-system', 'v2', 'True', 'rev-2')];
		await wait(150);

		try {
			const modified = events.filter((e) => e.type === 'MODIFIED');
			expect(modified.length).toBeGreaterThan(0);
		} finally {
			unsub();
		}
	});

	test('spec-only edits refresh subscribers without storing a notification', async () => {
		const events: SSEEvent[] = [];
		const clusterId = uniqueClusterId('spec-only');
		mockResources = [{ ...makeResource('my-app', 'flux-system', 'v1'), spec: { suspend: false } }];
		const unsub = subscribe((event) => events.push(event), clusterId);
		await wait(120);
		const initialHistoryCalls = mockCaptureReconciliation.mock.calls.length;

		mockResources = [{ ...makeResource('my-app', 'flux-system', 'v1'), spec: { suspend: true } }];
		await wait(120);

		try {
			const modified = events.filter(
				(event) => event.type === 'MODIFIED' && event.resourceType === 'GitRepository'
			);
			expect(modified).toHaveLength(1);
			expect(modified[0]?.notify).toBe(false);
			expect(mockCaptureReconciliation).toHaveBeenCalledTimes(initialHistoryCalls);
		} finally {
			unsub();
		}
	});

	test('unchanged resources emit no MODIFIED event or reconciliation history', async () => {
		const events: SSEEvent[] = [];
		const clusterId = uniqueClusterId('unchanged');
		mockResources = [makeResource('my-app', 'flux-system', 'v1')];
		const unsub = subscribe((event) => events.push(event), clusterId);
		await wait(120);
		const historyCallsAfterAdd = mockCaptureReconciliation.mock.calls.length;
		await wait(120);

		try {
			expect(
				events.filter(
					(event) => event.type === 'MODIFIED' && event.resourceType === 'GitRepository'
				)
			).toHaveLength(0);
			expect(mockCaptureReconciliation).toHaveBeenCalledTimes(historyCallsAfterAdd);
		} finally {
			unsub();
		}
	});

	test('polls every supported Flux type sequentially', async () => {
		const clusterId = uniqueClusterId('all-resource-types');
		const unsub = subscribe(() => {}, clusterId);
		await wait(120);

		try {
			const firstCycleTypes = listCalls
				.slice(0, getAllResourceTypes().length)
				.map((call) => call.resourceType);
			expect(firstCycleTypes).toEqual(getAllResourceTypes());
		} finally {
			unsub();
		}
	});

	test('403/404 failures preserve cached state and retry after the type cooldown', async () => {
		const events: SSEEvent[] = [];
		const clusterId = uniqueClusterId('cooldown');
		let responseMode: 'success' | 'failure' | 'corrected' = 'success';
		let clock = Date.now();
		const originalNow = Date.now;
		vi.spyOn(Date, 'now').mockImplementation(() => clock);
		mockListFluxResources = async (resourceType) => {
			listCalls.push({ resourceType });
			if (resourceType === 'GitRepository' && responseMode === 'failure') {
				throw Object.assign(new Error('API unavailable'), { response: { statusCode: 404 } });
			}
			if (resourceType === 'GitRepository' && responseMode === 'corrected') {
				return {
					items: [{ ...makeResource('cached', 'flux-system', 'v2'), spec: { suspend: true } }]
				};
			}
			return { items: [makeResource('cached', 'flux-system', 'v1')] };
		};
		const unsub = subscribe((event) => events.push(event), clusterId);
		await wait(120);
		responseMode = 'failure';
		await wait(120);

		try {
			const failedCallCount = listCalls.filter(
				(call) => call.resourceType === 'GitRepository'
			).length;
			expect(
				events.some((event) => event.type === 'DELETED' && event.resourceType === 'GitRepository')
			).toBe(false);
			await wait(120);
			expect(listCalls.filter((call) => call.resourceType === 'GitRepository')).toHaveLength(
				failedCallCount
			);

			clock = originalNow() + 60_001;
			responseMode = 'corrected';
			await wait(120);
			expect(
				listCalls.filter((call) => call.resourceType === 'GitRepository').length
			).toBeGreaterThan(failedCallCount);
			expect(
				events.some(
					(event) =>
						event.type === 'MODIFIED' &&
						event.resourceType === 'GitRepository' &&
						event.notify === false
				)
			).toBe(true);
		} finally {
			unsub();
		}
	});

	test('unavailable-type cooldowns are isolated by cluster', async () => {
		const clusterWithFailure = uniqueClusterId('cooldown-isolated-a');
		const healthyCluster = uniqueClusterId('cooldown-isolated-b');
		mockListFluxResources = async (resourceType, clusterId) => {
			listCalls.push({ resourceType, clusterId });
			if (clusterId === clusterWithFailure && resourceType === 'GitRepository') {
				throw Object.assign(new Error('forbidden'), { code: 403 });
			}
			return { items: [] };
		};
		const unsubscribeFailedCluster = subscribe(() => {}, clusterWithFailure);
		const unsubscribeHealthyCluster = subscribe(() => {}, healthyCluster);
		await wait(180);

		try {
			const failedClusterCalls = listCalls.filter(
				(call) => call.clusterId === clusterWithFailure && call.resourceType === 'GitRepository'
			);
			const healthyClusterCalls = listCalls.filter(
				(call) => call.clusterId === healthyCluster && call.resourceType === 'GitRepository'
			);
			expect(failedClusterCalls).toHaveLength(1);
			expect(healthyClusterCalls.length).toBeGreaterThan(1);
		} finally {
			unsubscribeFailedCluster();
			unsubscribeHealthyCluster();
		}
	});

	test('a pending unavailable-type response after stop does not continue polling', async () => {
		let rejectGitRepository!: (error: Error) => void;
		const pending = new Promise<never>((_resolve, reject) => {
			rejectGitRepository = reject;
		});
		mockListFluxResources = async (resourceType) => {
			listCalls.push({ resourceType });
			if (resourceType === 'GitRepository') return pending;
			return { items: [] };
		};
		const unsub = subscribe(() => {}, uniqueClusterId('stop-pending'));
		await wait(20);
		unsub();
		rejectGitRepository(Object.assign(new Error('forbidden'), { code: 403 }));
		await wait(80);

		expect(listCalls.map((call) => call.resourceType)).toEqual(['GitRepository']);
	});

	test('resource disappearing from poll broadcasts DELETED event', async () => {
		const events: SSEEvent[] = [];
		const clusterId = uniqueClusterId('deleted');

		// Start with a resource present
		mockResources = [makeResource('my-app', 'flux-system', 'v1')];
		const unsub = subscribe((e) => events.push(e), clusterId);

		// Wait for first poll
		await wait(150);

		// Remove the resource
		mockResources = [];
		await wait(150);

		try {
			const deleted = events.filter((e) => e.type === 'DELETED');
			expect(deleted.length).toBeGreaterThan(0);
		} finally {
			unsub();
		}
	});

	test('new resource after settling period broadcasts ADDED event', async () => {
		const events: SSEEvent[] = [];
		const clusterId = uniqueClusterId('added-settle');

		// Start with no resources
		mockResources = [];
		const unsub = subscribe((e) => events.push(e), clusterId);

		// Wait for initial poll (empty)
		await wait(150);

		// Add a resource — with SETTLING_PERIOD_MS=-1 it should be notified immediately
		mockResources = [makeResource('new-app', 'flux-system', 'v1')];
		await wait(150);

		try {
			const added = events.filter((e) => e.type === 'ADDED');
			expect(added.length).toBeGreaterThan(0);
		} finally {
			unsub();
		}
	});

	test('resource removed before settling is cleaned up without DELETED broadcast', async () => {
		vi.resetModules();
		applyEventMocks({ settlingPeriodMs: 60_000 });
		const eventsModule = await importFresh<EventsModule>('../lib/server/events.js');
		const subscribeWithSettling = eventsModule.subscribe;

		const events: SSEEvent[] = [];
		const clusterId = uniqueClusterId('removed-before-settle');
		mockResources = [makeResource('new-app', 'flux-system', 'v1')];
		const unsub = subscribeWithSettling((e) => events.push(e), clusterId);
		await wait(150);

		mockResources = [];
		await wait(150);

		try {
			expect(events.some((e) => e.type === 'ADDED')).toBe(false);
			expect(events.some((e) => e.type === 'DELETED')).toBe(false);
		} finally {
			unsub();
		}
	});

	test('captureReconciliation failure does not block ADDED event broadcast', async () => {
		const events: SSEEvent[] = [];
		const clusterId = uniqueClusterId('reconciliation-failure');
		mockCaptureReconciliation.mockRejectedValueOnce(new Error('history unavailable'));

		mockResources = [makeResource('new-app', 'flux-system', 'v1')];
		const unsub = subscribe((e) => events.push(e), clusterId);

		await wait(150);

		try {
			expect(mockCaptureReconciliation).toHaveBeenCalled();
			expect(events.some((e) => e.type === 'ADDED')).toBe(true);
		} finally {
			unsub();
		}
	});

	test('transient Unknown ready status refreshes subscribers without notification', async () => {
		const events: SSEEvent[] = [];
		const clusterId = uniqueClusterId('unknown-transient');

		// Start with a healthy resource
		mockResources = [makeResource('my-app', 'flux-system', 'v1', 'True', 'rev-1')];
		const unsub = subscribe((e) => events.push(e), clusterId);

		// Wait for first poll to record the resource
		await wait(150);
		const eventsAfterFirstPoll = events.length;

		// Transition to Unknown (transient) - same revision, no failure
		mockResources = [makeResource('my-app', 'flux-system', 'v2', 'Unknown', 'rev-1')];
		await wait(150);

		try {
			const modifiedAfter = events
				.slice(eventsAfterFirstPoll)
				.filter((e) => e.type === 'MODIFIED' && e.resourceType === 'GitRepository');
			expect(modifiedAfter).toHaveLength(1);
			expect(modifiedAfter[0]?.notify).toBe(false);
		} finally {
			unsub();
		}
	});

	test('transient Unknown ready status with changed revision waits for stable notification', async () => {
		const events: SSEEvent[] = [];
		const clusterId = uniqueClusterId('unknown-revision-transient');

		mockResources = [makeResource('my-app', 'flux-system', 'v1', 'True', 'rev-1')];
		const unsub = subscribe((e) => events.push(e), clusterId);

		await wait(150);
		const eventsAfterFirstPoll = events.length;

		mockResources = [makeResource('my-app', 'flux-system', 'v2', 'Unknown', 'rev-2')];
		await wait(150);

		const modifiedWhileUnknown = events
			.slice(eventsAfterFirstPoll)
			.filter((e) => e.type === 'MODIFIED' && e.resourceType === 'GitRepository');

		mockResources = [makeResource('my-app', 'flux-system', 'v3', 'True', 'rev-2')];
		await wait(150);

		try {
			const stableModified = events
				.slice(eventsAfterFirstPoll)
				.filter(
					(e) => e.type === 'MODIFIED' && e.resourceType === 'GitRepository' && e.notify !== false
				);
			expect(modifiedWhileUnknown).toHaveLength(1);
			expect(modifiedWhileUnknown[0]?.notify).toBe(false);
			expect(stableModified).toHaveLength(1);
			expect(stableModified[0]?.notify).toBeUndefined();
		} finally {
			unsub();
		}
	});

	test('failed resources recover with notification after passing through transient Unknown', async () => {
		const events: SSEEvent[] = [];
		const clusterId = uniqueClusterId('failed-recovery');
		mockResources = [makeResource('recovering-app', 'flux-system', 'v1', 'True', 'rev-1')];
		const unsub = subscribe((event) => events.push(event), clusterId);
		await wait(120);
		const historyAfterAdd = mockCaptureReconciliation.mock.calls.length;

		mockResources = [makeResource('recovering-app', 'flux-system', 'v2', 'False', 'rev-1')];
		await wait(120);
		const historyAfterFailure = mockCaptureReconciliation.mock.calls.length;
		mockResources = [makeResource('recovering-app', 'flux-system', 'v3', 'Unknown', 'rev-1')];
		await wait(120);
		const historyAfterTransient = mockCaptureReconciliation.mock.calls.length;
		mockResources = [makeResource('recovering-app', 'flux-system', 'v4', 'True', 'rev-1')];
		await wait(120);

		try {
			const modified = events.filter(
				(event) => event.type === 'MODIFIED' && event.resourceType === 'GitRepository'
			);
			expect(historyAfterFailure).toBeGreaterThan(historyAfterAdd);
			expect(historyAfterTransient).toBe(historyAfterFailure);
			expect(mockCaptureReconciliation.mock.calls.length).toBeGreaterThan(historyAfterTransient);
			expect(modified).toHaveLength(3);
			expect(modified.map((event) => event.notify)).toEqual([undefined, false, undefined]);
		} finally {
			unsub();
		}
	});

	test('resource becoming False (failed) triggers notification', async () => {
		const events: SSEEvent[] = [];
		const clusterId = uniqueClusterId('failed');

		// Start with healthy resource
		mockResources = [makeResource('my-app', 'flux-system', 'v1', 'True', 'rev-1')];
		const unsub = subscribe((e) => events.push(e), clusterId);

		// Wait for first poll
		await wait(150);

		// Resource fails with same revision but status becomes False
		mockResources = [
			{
				metadata: {
					name: 'my-app',
					namespace: 'flux-system',
					resourceVersion: 'v2',
					generation: 1,
					uid: 'test-uid'
				},
				status: {
					observedGeneration: 1,
					conditions: [
						{
							type: 'Ready',
							status: 'False',
							reason: 'ReconciliationFailed',
							message: 'Apply failed: error'
						}
					],
					lastAppliedRevision: 'rev-1' // same revision, failure
				}
			}
		];
		await wait(150);

		try {
			const modified = events.filter((e) => e.type === 'MODIFIED');
			expect(modified.length).toBeGreaterThan(0);
		} finally {
			unsub();
		}
	});
});
