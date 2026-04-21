import { logger } from '../logger.js';
import { IN_CLUSTER_ID } from '$lib/clusters/identity.js';
import { HEARTBEAT_INTERVAL_MS } from '../config/constants.js';
import { activeWorkers, isShuttingDown, SERVER_SESSION_ID } from './state.js';
import { activeWorkersGauge, fluxResourceStatusGauge, sseSubscribersGauge } from '../metrics.js';
import { poll } from './poller.js';
import { normalizeError, type ClusterContext, type SSEEvent, type Subscriber } from './types.js';

/**
 * Subscribe to events for a specific cluster
 * @param clusterId - The cluster to watch
 * @param subscriber - Callback for events
 */
export function subscribe(subscriber: Subscriber, clusterId: string = IN_CLUSTER_ID): () => void {
	// Prevent new subscriptions during shutdown
	if (isShuttingDown) {
		logger.warn({ clusterId }, '[EventBus] Rejecting new subscription: shutting down');
		return () => {};
	}

	let context = activeWorkers.get(clusterId);

	if (!context) {
		context = {
			clusterId,
			subscribers: new Set(),
			isActive: false,
			pollTimeout: null,
			heartbeatInterval: null,
			inflightPollPromise: null,
			lastStates: new Map(),
			lastNotificationStates: new Map(),
			resourceFirstSeen: new Map()
		};
		activeWorkers.set(clusterId, context);
	}

	context.subscribers.add(subscriber);
	sseSubscribersGauge.labels(clusterId).set(context.subscribers.size);

	// Initial connection message
	subscriber({
		type: 'CONNECTED',
		clusterId,
		serverSessionId: SERVER_SESSION_ID,
		message: `Connected to event stream for cluster: ${clusterId}`,
		timestamp: new Date().toISOString()
	});

	if (!context.isActive) {
		startWorker(context);
	}

	return () => {
		const ctx = activeWorkers.get(clusterId);
		if (!ctx) return;

		ctx.subscribers.delete(subscriber);
		sseSubscribersGauge.labels(clusterId).set(ctx.subscribers.size);

		if (ctx.subscribers.size === 0) {
			stopWorker(ctx, 'no active subscribers');
			activeWorkers.delete(clusterId);
		}
	};
}

export function startWorker(context: ClusterContext) {
	if (context.isActive) return;
	context.isActive = true;
	activeWorkersGauge.set(activeWorkers.size);
	logger.info({ clusterId: context.clusterId }, '[EventBus] Starting consolidated polling worker');

	poll(context);

	context.heartbeatInterval = setInterval(() => {
		broadcast(context, {
			type: 'HEARTBEAT',
			clusterId: context.clusterId,
			timestamp: new Date().toISOString()
		});
	}, HEARTBEAT_INTERVAL_MS);
}

export function stopWorker(context: ClusterContext, reason: string = 'no active subscribers') {
	if (!context.isActive) return;
	context.isActive = false;
	activeWorkersGauge.set(Array.from(activeWorkers.values()).filter((w) => w.isActive).length);
	if (context.pollTimeout) {
		clearTimeout(context.pollTimeout);
		context.pollTimeout = null;
	}
	if (context.heartbeatInterval) {
		clearInterval(context.heartbeatInterval);
		context.heartbeatInterval = null;
	}
	for (const key of context.lastStates.keys()) {
		const [type, namespace, name] = key.split('/');
		fluxResourceStatusGauge.remove(context.clusterId, type, namespace, name, 'Ready');
	}
	context.lastStates.clear();
	context.lastNotificationStates.clear();
	context.resourceFirstSeen.clear();
	logger.info(
		{ clusterId: context.clusterId, reason },
		'[EventBus] Stopping consolidated polling worker'
	);
}

export function broadcast(context: ClusterContext, event: SSEEvent) {
	// The loop is fault-tolerant: if a subscriber callback throws (e.g. during SHUTDOWN due to a closed stream),
	// it is caught and logged, ensuring remaining subscribers still receive the event.
	for (const subscriber of context.subscribers) {
		try {
			subscriber(event);
		} catch (err) {
			if (event.type === 'SHUTDOWN') {
				logger.debug(
					{ clusterId: context.clusterId, err: normalizeError(err) },
					'[EventBus] Error broadcasting SHUTDOWN to subscriber'
				);
			} else {
				logger.error(
					{ clusterId: context.clusterId, err: normalizeError(err) },
					'[EventBus] Error broadcasting to subscriber'
				);
			}
		}
	}
}
