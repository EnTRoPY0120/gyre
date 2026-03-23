import { logger } from './logger.js';
import { listFluxResources } from './kubernetes/client.js';
import type { FluxResourceType } from './kubernetes/flux/resources.js';
import type { FluxResource, K8sCondition } from './kubernetes/flux/types.js';
import {
	resourcePollsTotal,
	resourceUpdatesTotal,
	sseSubscribersGauge,
	activeWorkersGauge,
	fluxResourceStatusGauge
} from './metrics.js';
import { captureReconciliation } from './kubernetes/flux/reconciliation-tracker.js';
import { SETTLING_PERIOD_MS, POLL_INTERVAL_MS, HEARTBEAT_INTERVAL_MS } from './config/constants.js';

function normalizeError(value: unknown): Error | { message: string; value: unknown } {
	if (value instanceof Error) return value;
	if (typeof value === 'string') return new Error(value);
	return { message: 'Non-Error rejection', value };
}

// Resource types to watch
const WATCH_RESOURCES: FluxResourceType[] = [
	'GitRepository',
	'HelmRepository',
	'Kustomization',
	'HelmRelease'
];

export interface SSEEvent {
	type: 'CONNECTED' | 'ADDED' | 'MODIFIED' | 'DELETED' | 'HEARTBEAT' | 'SHUTDOWN';
	clusterId?: string;
	resourceType?: string;
	resource?: unknown;
	message?: string;
	timestamp: string;
	serverSessionId?: string;
}

// Stable identifier for this server process lifetime; changes on restart
const SERVER_SESSION_ID = Date.now().toString(36);

type Subscriber = (event: SSEEvent) => void;

interface ClusterContext {
	clusterId: string;
	subscribers: Set<Subscriber>;
	isActive: boolean;
	pollTimeout: NodeJS.Timeout | null;
	heartbeatInterval: NodeJS.Timeout | null;
	inflightPollPromise: Promise<void> | null;
	lastStates: Map<string, string>;
	lastNotificationStates: Map<string, string>;
	resourceFirstSeen: Map<string, number>;
}

// Map of active polling workers per cluster
const activeWorkers = new Map<string, ClusterContext>();

// Shutdown flag to prevent new subscriptions during shutdown
let isShuttingDown = false;

/**
 * Mark the event bus as shutting down to prevent new subscriptions
 */
export function setEventBusShuttingDown(): void {
	isShuttingDown = true;
}

/**
 * Close all active event streams (used during graceful shutdown)
 */
export async function closeAllEventStreams() {
	logger.info('[EventBus] Shutting down all event streams...');
	isShuttingDown = true;

	// Collect inflight promises before touching any context so the broadcast loop
	// below is not delayed by sequential awaits.
	const inflightPromises: Array<[string, Promise<void>]> = [];
	for (const [clusterId, context] of Array.from(activeWorkers.entries())) {
		if (context.inflightPollPromise) {
			inflightPromises.push([clusterId, context.inflightPollPromise]);
		}

		// Broadcast SHUTDOWN to all subscribers - this will trigger their unsubscribe()
		// which will call stopWorker and remove from activeWorkers
		broadcast(context, {
			type: 'SHUTDOWN',
			clusterId,
			timestamp: new Date().toISOString()
		});
		// Explicitly call stopWorker to guarantee timer cleanup even if a subscriber throws.
		// It is safe if stopWorker is called twice (idempotent check for null intervals).
		stopWorker(context, 'server shutdown');

		// Subscribers are cleared by their unsubscribe callbacks during broadcast.
		// The guard exists because unsubscribe() may have already called activeWorkers.delete(clusterId)
		// during the broadcast, modifying the Map during live iteration.
		if (activeWorkers.has(clusterId)) {
			context.subscribers.clear();
		}
	}

	// Await all inflight polls concurrently now that all workers are stopped.
	const pollResults = await Promise.allSettled(inflightPromises.map(([, p]) => p));
	pollResults.forEach((result, i) => {
		if (result.status === 'rejected') {
			logger.error(
				{ clusterId: inflightPromises[i][0], err: normalizeError(result.reason) },
				'[EventBus] Error awaiting poll'
			);
		}
	});
	activeWorkers.clear();
	// Reset metrics
	activeWorkersGauge.set(0);
	sseSubscribersGauge.reset();
}

/**
 * Subscribe to events for a specific cluster
 * @param clusterId - The cluster to watch
 * @param subscriber - Callback for events
 */
export function subscribe(subscriber: Subscriber, clusterId: string = 'in-cluster'): () => void {
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

function startWorker(context: ClusterContext) {
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

function stopWorker(context: ClusterContext, reason: string = 'no active subscribers') {
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
	logger.info(
		{ clusterId: context.clusterId, reason },
		'[EventBus] Stopping consolidated polling worker'
	);
}

function broadcast(context: ClusterContext, event: SSEEvent) {
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

async function poll(context: ClusterContext) {
	if (!context.isActive) return;

	let resolvePoll: () => void = () => {};
	const promise = new Promise<void>((resolve) => {
		resolvePoll = resolve;
	});
	context.inflightPollPromise = promise;

	try {
		for (const resourceType of WATCH_RESOURCES) {
			try {
				// Pass clusterId to listFluxResources to get resources from the correct cluster
				const resourceList = await listFluxResources(
					resourceType,
					context.clusterId === 'in-cluster' ? undefined : context.clusterId
				);

				resourcePollsTotal.labels(context.clusterId, resourceType, 'success').inc();

				if (resourceList && resourceList.items) {
					const currentMessageKeys = new Set<string>();

					for (const resource of resourceList.items) {
						const key = `${resourceType}/${resource.metadata.namespace}/${resource.metadata.name}`;
						currentMessageKeys.add(key);

						const conditions = resource.status?.conditions?.map((c: K8sCondition) => ({
							type: c.type,
							status: c.status,
							reason: c.reason,
							message: c.message
						}));

						const currentState = JSON.stringify({
							resourceVersion: resource.metadata?.resourceVersion,
							generation: resource.metadata?.generation,
							observedGeneration: resource.status?.observedGeneration
						});

						const readyCondition = conditions?.find((c: { type: string }) => c.type === 'Ready');

						// Update resource status gauge
						fluxResourceStatusGauge
							.labels(
								context.clusterId,
								resourceType,
								resource.metadata.namespace || 'unknown',
								resource.metadata.name || 'unknown',
								'Ready'
							)
							.set(readyCondition?.status === 'True' ? 1 : 0);

						const revision = getResourceRevision(resource);

						const notificationState = JSON.stringify({
							revision: revision,
							readyStatus: readyCondition?.status,
							readyReason: readyCondition?.reason,
							messagePreview: readyCondition?.message?.substring(0, 100) || ''
						});

						const previousState = context.lastStates.get(key);

						const now = Date.now();
						if (!context.resourceFirstSeen.has(key)) {
							context.resourceFirstSeen.set(key, now);
						}
						const firstSeen = context.resourceFirstSeen.get(key) || now;
						const isSettled = now - firstSeen > SETTLING_PERIOD_MS;

						if (!previousState) {
							if (isSettled) {
								resourceUpdatesTotal.labels(context.clusterId, resourceType, 'added').inc();

								// Capture initial reconciliation history
								try {
									await captureReconciliation({
										resourceType,
										namespace: resource.metadata.namespace || '',
										name: resource.metadata.name || '',
										clusterId: context.clusterId,
										resource,
										triggerType: 'automatic'
									});
								} catch (err) {
									logger.error(
										{
											err: normalizeError(err),
											resourceType,
											resourceName: resource.metadata.name,
											namespace: resource.metadata.namespace
										},
										'[EventBus] Failed to capture reconciliation history'
									);
									// Don't fail event broadcast if history capture fails
								}

								broadcast(context, {
									type: 'ADDED',
									clusterId: context.clusterId,
									resourceType,
									resource: {
										metadata: {
											name: resource.metadata.name,
											namespace: resource.metadata.namespace,
											uid: resource.metadata.uid || 'unknown'
										},
										status: resource.status
									},
									timestamp: new Date().toISOString()
								});
							}
							context.lastNotificationStates.set(key, notificationState);
						} else if (previousState && previousState !== currentState) {
							const previousNotificationState = context.lastNotificationStates.get(key);

							if (!previousNotificationState || previousNotificationState !== notificationState) {
								const prevState = previousNotificationState
									? JSON.parse(previousNotificationState)
									: {};
								const currState = JSON.parse(notificationState);

								const revisionChanged = prevState.revision !== currState.revision;
								const becameFailed = currState.readyStatus === 'False';
								const becameHealthy =
									prevState.readyStatus === 'False' && currState.readyStatus === 'True';
								const isTransientState = currState.readyStatus === 'Unknown';

								const shouldNotify =
									revisionChanged || becameFailed || (becameHealthy && revisionChanged);

								if (shouldNotify && !isTransientState) {
									resourceUpdatesTotal.labels(context.clusterId, resourceType, 'modified').inc();

									// Capture reconciliation history
									try {
										await captureReconciliation({
											resourceType,
											namespace: resource.metadata.namespace || '',
											name: resource.metadata.name || '',
											clusterId: context.clusterId,
											resource,
											triggerType: 'automatic'
										});
									} catch (err) {
										logger.error(
											{
												err: normalizeError(err),
												resourceType,
												resourceName: resource.metadata.name,
												namespace: resource.metadata.namespace
											},
											'[EventBus] Failed to capture reconciliation history'
										);
										// Don't fail event broadcast if history capture fails
									}

									broadcast(context, {
										type: 'MODIFIED',
										clusterId: context.clusterId,
										resourceType,
										resource: {
											metadata: {
												name: resource.metadata.name,
												namespace: resource.metadata.namespace,
												uid: resource.metadata.uid || 'unknown'
											},
											status: resource.status
										},
										timestamp: new Date().toISOString()
									});
								}
								context.lastNotificationStates.set(key, notificationState);
							}
						}

						context.lastStates.set(key, currentState);
						// Once settled and tracked in lastStates, firstSeen is no longer needed
						if (isSettled) {
							context.resourceFirstSeen.delete(key);
						}
					}

					for (const key of context.lastStates.keys()) {
						if (key.startsWith(`${resourceType}/`) && !currentMessageKeys.has(key)) {
							const [type, namespace, name] = key.split('/');

							// Clear status gauge
							fluxResourceStatusGauge.remove(context.clusterId, type, namespace, name, 'Ready');

							resourceUpdatesTotal.labels(context.clusterId, type, 'deleted').inc();
							broadcast(context, {
								type: 'DELETED',
								clusterId: context.clusterId,
								resourceType: type,
								resource: {
									metadata: {
										name: name,
										namespace: namespace,
										uid: 'unknown'
									}
								},
								timestamp: new Date().toISOString()
							});

							context.lastStates.delete(key);
							context.lastNotificationStates.delete(key);
							context.resourceFirstSeen.delete(key);
						}
					}
				}
			} catch (err) {
				resourcePollsTotal.labels(context.clusterId, resourceType, 'error').inc();
				logger.error(
					{ clusterId: context.clusterId, resourceType, err: normalizeError(err) },
					'[EventBus] Error polling resource type'
				);
			}
		}
	} catch (err) {
		logger.error(
			{ clusterId: context.clusterId, err: normalizeError(err) },
			'[EventBus] Critical error in poll loop'
		);
	} finally {
		resolvePoll!();
		context.inflightPollPromise = null;
	}

	if (context.isActive) {
		context.pollTimeout = setTimeout(() => poll(context), POLL_INTERVAL_MS);
	}
}

function getResourceRevision(resource: FluxResource): string {
	return (
		resource.status?.lastAppliedRevision ||
		resource.status?.artifact?.revision ||
		resource.status?.lastAttemptedRevision ||
		''
	);
}
