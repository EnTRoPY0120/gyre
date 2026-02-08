import { listFluxResources } from './kubernetes/client.js';
import type { FluxResourceType } from './kubernetes/flux/resources.js';
import type { FluxResource, K8sCondition } from './kubernetes/flux/types.js';
import { resourcePollsTotal, resourceUpdatesTotal } from './metrics.js';

// Resource types to watch
const WATCH_RESOURCES: FluxResourceType[] = [
	'GitRepository',
	'HelmRepository',
	'Kustomization',
	'HelmRelease'
];

const SETTLING_PERIOD_MS = 30000;
const POLL_INTERVAL_MS = 5000;
const HEARTBEAT_INTERVAL_MS = 30000;

export interface SSEEvent {
	type: 'CONNECTED' | 'ADDED' | 'MODIFIED' | 'DELETED' | 'HEARTBEAT';
	clusterId?: string;
	resourceType?: string;
	resource?: unknown;
	message?: string;
	timestamp: string;
}

type Subscriber = (event: SSEEvent) => void;

interface ClusterContext {
	clusterId: string;
	subscribers: Set<Subscriber>;
	isActive: boolean;
	pollTimeout: NodeJS.Timeout | null;
	heartbeatInterval: NodeJS.Timeout | null;
	lastStates: Map<string, string>;
	lastNotificationStates: Map<string, string>;
	resourceFirstSeen: Map<string, number>;
}

// Map of active polling workers per cluster
const activeWorkers = new Map<string, ClusterContext>();

/**
 * Subscribe to events for a specific cluster
 * @param clusterId - The cluster to watch
 * @param subscriber - Callback for events
 */
export function subscribe(subscriber: Subscriber, clusterId: string = 'in-cluster'): () => void {
	let context = activeWorkers.get(clusterId);

	if (!context) {
		context = {
			clusterId,
			subscribers: new Set(),
			isActive: false,
			pollTimeout: null,
			heartbeatInterval: null,
			lastStates: new Map(),
			lastNotificationStates: new Map(),
			resourceFirstSeen: new Map()
		};
		activeWorkers.set(clusterId, context);
	}

	context.subscribers.add(subscriber);

	// Initial connection message
	subscriber({
		type: 'CONNECTED',
		clusterId,
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

		if (ctx.subscribers.size === 0) {
			stopWorker(ctx);
			activeWorkers.delete(clusterId);
		}
	};
}

function startWorker(context: ClusterContext) {
	if (context.isActive) return;
	context.isActive = true;
	console.log(`[EventBus] Starting consolidated polling worker for cluster: ${context.clusterId}`);

	poll(context);

	context.heartbeatInterval = setInterval(() => {
		broadcast(context, {
			type: 'HEARTBEAT',
			clusterId: context.clusterId,
			timestamp: new Date().toISOString()
		});
	}, HEARTBEAT_INTERVAL_MS);
}

function stopWorker(context: ClusterContext) {
	context.isActive = false;
	if (context.pollTimeout) {
		clearTimeout(context.pollTimeout);
		context.pollTimeout = null;
	}
	if (context.heartbeatInterval) {
		clearInterval(context.heartbeatInterval);
		context.heartbeatInterval = null;
	}
	console.log(
		`[EventBus] Stopping consolidated polling worker for cluster: ${context.clusterId} (no active subscribers)`
	);
}

function broadcast(context: ClusterContext, event: SSEEvent) {
	for (const subscriber of context.subscribers) {
		try {
			subscriber(event);
		} catch (err) {
			console.error(
				`[EventBus] Error broadcasting to subscriber on cluster ${context.clusterId}:`,
				err
			);
		}
	}
}

async function poll(context: ClusterContext) {
	if (!context.isActive) return;

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
					}

					for (const key of context.lastStates.keys()) {
						if (key.startsWith(`${resourceType}/`) && !currentMessageKeys.has(key)) {
							const [type, namespace, name] = key.split('/');

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
				console.error(
					`[EventBus] Error polling ${resourceType} for cluster ${context.clusterId}:`,
					err
				);
			}
		}
	} catch (err) {
		console.error(`[EventBus] Critical error in poll loop for cluster ${context.clusterId}:`, err);
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
