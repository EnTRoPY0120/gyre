import { logger } from '../logger.js';
import { IN_CLUSTER_ID } from '$lib/clusters/identity.js';
import { listFluxResources } from '../kubernetes/client.js';
import type { FluxResourceType } from '../kubernetes/flux/resources.js';
import type { FluxResource, K8sCondition } from '../kubernetes/flux/types.js';
import { resourcePollsTotal, resourceUpdatesTotal, fluxResourceStatusGauge } from '../metrics.js';
import { captureReconciliation } from '../kubernetes/flux/reconciliation-tracker.js';
import { POLL_INTERVAL_MS, SETTLING_PERIOD_MS } from '../config/constants.js';
import { broadcast } from './bus.js';
import { normalizeError, type ClusterContext } from './types.js';

const WATCH_RESOURCES: FluxResourceType[] = [
	'GitRepository',
	'HelmRepository',
	'Kustomization',
	'HelmRelease'
];

export async function poll(context: ClusterContext) {
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
					context.clusterId === IN_CLUSTER_ID ? undefined : context.clusterId
				);

				if (!context.isActive) return;

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
						// Only record firstSeen for resources not yet in lastStates.
						// Resources in lastStates but missing from resourceFirstSeen had their
						// entry pruned after settling — treat them as already settled.
						if (!context.resourceFirstSeen.has(key) && !context.lastStates.has(key)) {
							context.resourceFirstSeen.set(key, now);
						}
						const isSettled = context.resourceFirstSeen.has(key)
							? now - context.resourceFirstSeen.get(key)! > SETTLING_PERIOD_MS
							: true; // no firstSeen entry + exists in lastStates = already settled

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

								if (!context.isActive) return;

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

								context.lastStates.set(key, currentState);
								context.lastNotificationStates.set(key, notificationState);
								context.resourceFirstSeen.delete(key);
							}
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
								const isTransientState =
									!currState.readyStatus || currState.readyStatus === 'Unknown';

								const shouldNotify = revisionChanged || becameFailed || becameHealthy;

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

									if (!context.isActive) return;

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
								if (!isTransientState) {
									context.lastNotificationStates.set(key, notificationState);
								}
							}

							context.lastStates.set(key, currentState);
						}
					}

					for (const key of Array.from(context.lastStates.keys())) {
						if (key.startsWith(`${resourceType}/`) && !currentMessageKeys.has(key)) {
							broadcastDeletedResource(context, key);
						}
					}

					for (const key of Array.from(context.resourceFirstSeen.keys())) {
						if (
							key.startsWith(`${resourceType}/`) &&
							!currentMessageKeys.has(key) &&
							!context.lastStates.has(key)
						) {
							broadcastDeletedResource(context, key);
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

function broadcastDeletedResource(context: ClusterContext, key: string) {
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

function getResourceRevision(resource: FluxResource): string {
	return (
		resource.status?.lastAppliedRevision ||
		resource.status?.artifact?.revision ||
		resource.status?.lastAttemptedRevision ||
		''
	);
}
