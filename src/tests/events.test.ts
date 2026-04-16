import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import * as actualClient from '../lib/server/kubernetes/client.js';
import * as actualMetrics from '../lib/server/metrics.js';
import { importFresh } from './helpers/import-fresh';

// Suppress console noise - must be before imports
spyOn(console, 'log').mockImplementation(() => {});
spyOn(console, 'warn').mockImplementation(() => {});
spyOn(console, 'error').mockImplementation(() => {});

// Mock listFluxResources to control what resources are returned
let mockResources: any[] = [];
type EventsModule = typeof import('../lib/server/events.js');
import type { SSEEvent } from '../lib/server/events.js';
let subscribe: EventsModule['subscribe'];
let closeAllEventStreams: EventsModule['closeAllEventStreams'];
let setEventBusShuttingDown: EventsModule['setEventBusShuttingDown'];

beforeEach(async () => {
	mockResources = [];
	mock.module('../lib/server/kubernetes/client.js', () => ({
		...actualClient,
		listFluxResources: async () => ({ items: mockResources })
	}));
	mock.module('../lib/server/metrics.js', () => ({
		...actualMetrics,
		resourcePollsTotal: { labels: () => ({ inc: () => {} }) },
		resourceUpdatesTotal: { labels: () => ({ inc: () => {} }) },
		sseSubscribersGauge: { labels: () => ({ set: () => {} }), reset: () => {} },
		activeWorkersGauge: { set: () => {} },
		fluxResourceStatusGauge: { labels: () => ({ set: () => {} }), remove: () => {} }
	}));
	mock.module('../lib/server/kubernetes/flux/reconciliation-tracker.js', () => ({
		captureReconciliation: async () => {}
	}));
	mock.module('../lib/server/config/constants.js', () => ({
		SETTLING_PERIOD_MS: -1,
		POLL_INTERVAL_MS: 50,
		HEARTBEAT_INTERVAL_MS: 10000
	}));
	mock.module('../lib/server/logger.js', () => ({
		logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} }
	}));
	const eventsModule = await importFresh<EventsModule>('../lib/server/events.js');
	subscribe = eventsModule.subscribe;
	closeAllEventStreams = eventsModule.closeAllEventStreams;
	setEventBusShuttingDown = eventsModule.setEventBusShuttingDown;
});

afterEach(() => {
	mock.restore();
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
// IMPORTANT: Do NOT call closeAllEventStreams() in cleanup — it sets
// isShuttingDown=true, which is module-level state that cannot be reset.
// Instead, each test calls unsub() to stop the worker cleanly.
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

	test('transient Unknown ready status does not trigger notification', async () => {
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
			// Unknown status with unchanged revision should NOT trigger a MODIFIED notification
			const modifiedAfter = events.slice(eventsAfterFirstPoll).filter((e) => e.type === 'MODIFIED');
			expect(modifiedAfter.length).toBe(0);
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

// ---------------------------------------------------------------------------
// closeAllEventStreams()
// Note: closeAllEventStreams() sets isShuttingDown=true internally.
// The test for subscribe()-during-shutdown comes AFTER this section.
// ---------------------------------------------------------------------------

describe('closeAllEventStreams()', () => {
	test('broadcasts SHUTDOWN to all subscribers and stops workers', async () => {
		const events1: SSEEvent[] = [];
		const events2: SSEEvent[] = [];
		const clusterId = uniqueClusterId('shutdown-broadcast');
		mockResources = [];

		// Subscribe two subscribers (no cleanup via unsub — closeAllEventStreams handles it)
		subscribe((e) => events1.push(e), clusterId);
		subscribe((e) => events2.push(e), clusterId);

		await closeAllEventStreams();

		// Both subscribers should have received SHUTDOWN
		expect(events1.some((e) => e.type === 'SHUTDOWN')).toBe(true);
		expect(events2.some((e) => e.type === 'SHUTDOWN')).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// setEventBusShuttingDown() — MUST be last: sets unresettable module-level flag
// ---------------------------------------------------------------------------

describe('setEventBusShuttingDown()', () => {
	test('subsequent subscribe() calls return no-op and emit no CONNECTED event', () => {
		const events: SSEEvent[] = [];
		const clusterId = uniqueClusterId('shutdown-flag');

		setEventBusShuttingDown();

		const unsub = subscribe((e) => events.push(e), clusterId);

		// No CONNECTED event — subscription was rejected
		expect(events).toHaveLength(0);

		// Returned unsub is a no-op and must not throw
		expect(() => unsub()).not.toThrow();
	});
});

// ⚠️ WARNING: Do NOT add any tests below this point. setEventBusShuttingDown()
// sets an unresettable module-level flag that permanently disables subscribe().
// Any tests added after this block will fail because subscribe() will always return
// a no-op subscriber. This describe block must remain the final block in the file.
