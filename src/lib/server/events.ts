import { listFluxResources } from './kubernetes/client.js';
import type { FluxResourceType } from './kubernetes/flux/resources.js';
import type { FluxResource, K8sCondition } from './kubernetes/flux/types.js';

// Resource types to watch
const WATCH_RESOURCES: FluxResourceType[] = [
	'GitRepository',
	'HelmRepository',
	'Kustomization',
	'HelmRelease'
];

const SETTLING_PERIOD_MS = 30000; // Don't notify for 30s after first seeing a resource
const POLL_INTERVAL_MS = 5000; // Poll every 5 seconds
const HEARTBEAT_INTERVAL_MS = 30000; // Send heartbeat every 30 seconds

export interface SSEEvent {
	type: 'CONNECTED' | 'ADDED' | 'MODIFIED' | 'DELETED' | 'HEARTBEAT';
	resourceType?: string;
	resource?: unknown;
	message?: string;
	timestamp: string;
}

type Subscriber = (event: SSEEvent) => void;

// Module-level state (Singleton by nature of JS modules)
const subscribers = new Set<Subscriber>();
let isActive = false;
let pollTimeout: NodeJS.Timeout | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

// State tracking
const lastStates = new Map<string, string>();
const lastNotificationStates = new Map<string, string>();
const resourceFirstSeen = new Map<string, number>();

/**
 * Subscribe to the event bus
 * @param subscriber Callback for events
 * @returns Unsubscribe function
 */
export function subscribe(subscriber: Subscriber): () => void {
	subscribers.add(subscriber);

	// Send initial connection message
	subscriber({
		type: 'CONNECTED',
		message: 'Connected to event stream',
		timestamp: new Date().toISOString()
	});

	// Start polling if this is the first subscriber
	if (subscribers.size === 1) {
		start();
	}

	return () => {
		subscribers.delete(subscriber);
		// Stop polling if no more subscribers
		if (subscribers.size === 0) {
			stop();
		}
	};
}

function start() {
	if (isActive) return;
	isActive = true;
	console.log('[EventBus] Starting consolidated polling worker');

	poll();

	heartbeatInterval = setInterval(() => {
		broadcast({
			type: 'HEARTBEAT',
			timestamp: new Date().toISOString()
		});
	}, HEARTBEAT_INTERVAL_MS);
}

function stop() {
	isActive = false;
	if (pollTimeout) {
		clearTimeout(pollTimeout);
		pollTimeout = null;
	}
	if (heartbeatInterval) {
		clearInterval(heartbeatInterval);
		heartbeatInterval = null;
	}
	console.log('[EventBus] Stopping consolidated polling worker (no active subscribers)');
}

function broadcast(event: SSEEvent) {
	for (const subscriber of subscribers) {
		try {
			subscriber(event);
		} catch (err) {
			console.error('[EventBus] Error broadcasting to subscriber:', err);
		}
	}
}

async function poll() {
	if (!isActive) return;

	try {
		for (const resourceType of WATCH_RESOURCES) {
			const resourceList = await listFluxResources(resourceType);

			if (resourceList && resourceList.items) {
				const currentMessageKeys = new Set<string>();

				for (const resource of resourceList.items) {
					const key = `${resourceType}/${resource.metadata.namespace}/${resource.metadata.name}`;
					currentMessageKeys.add(key);

					// Extract only relevant status fields to avoid noisy notifications
					const conditions = resource.status?.conditions?.map((c: K8sCondition) => ({
						type: c.type,
						status: c.status,
						reason: c.reason,
						message: c.message
					}));

					// Use resourceVersion as the primary indicator of change
					const currentState = JSON.stringify({
						resourceVersion: resource.metadata?.resourceVersion,
						generation: resource.metadata?.generation,
						observedGeneration: resource.status?.observedGeneration
					});

					// For MODIFIED events, track "notification-worthy" state separately
					const readyCondition = conditions?.find((c: { type: string }) => c.type === 'Ready');
					const revision = getResourceRevision(resource);

					const notificationState = JSON.stringify({
						revision: revision,
						readyStatus: readyCondition?.status,
						readyReason: readyCondition?.reason,
						messagePreview: readyCondition?.message?.substring(0, 100) || ''
					});

					const previousState = lastStates.get(key);

					// Track when we first saw this resource
					const now = Date.now();
					if (!resourceFirstSeen.has(key)) {
						resourceFirstSeen.set(key, now);
					}
					const firstSeen = resourceFirstSeen.get(key) || now;
					const isSettled = now - firstSeen > SETTLING_PERIOD_MS;

					// Detect ADDED
					if (!previousState) {
						if (isSettled) {
							broadcast({
								type: 'ADDED',
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
						lastNotificationStates.set(key, notificationState);
					}
					// Detect MODIFIED
					else if (previousState && previousState !== currentState) {
						const previousNotificationState = lastNotificationStates.get(key);

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
								broadcast({
									type: 'MODIFIED',
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
							lastNotificationStates.set(key, notificationState);
						}
					}

					lastStates.set(key, currentState);
				}

				// Detect DELETED
				for (const key of lastStates.keys()) {
					if (key.startsWith(`${resourceType}/`) && !currentMessageKeys.has(key)) {
						const [type, namespace, name] = key.split('/');

						broadcast({
							type: 'DELETED',
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

						lastStates.delete(key);
						lastNotificationStates.delete(key);
						resourceFirstSeen.delete(key);
					}
				}
			}
		}
	} catch (err) {
		console.error('[EventBus] Error polling resources:', err);
	}

	if (isActive) {
		pollTimeout = setTimeout(() => poll(), POLL_INTERVAL_MS);
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
