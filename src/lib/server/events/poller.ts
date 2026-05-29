import { logger } from '../logger.js';
import { IN_CLUSTER_ID } from '$lib/clusters/identity.js';
import { listFluxResources } from '../kubernetes/client.js';
import type { FluxResourceType } from '../kubernetes/flux/resources.js';
import type { FluxResource, K8sCondition } from '../kubernetes/flux/types.js';
import { resourcePollsTotal, resourceUpdatesTotal, fluxResourceStatusGauge } from '../metrics.js';
import { captureReconciliation } from '../kubernetes/flux/reconciliation-tracker.js';
import { POLL_INTERVAL_MS, SETTLING_PERIOD_MS } from '../config/constants.js';
import { broadcast } from './dispatcher.js';
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
			const shouldContinue = await pollResourceType(context, resourceType);
			if (!shouldContinue) return;
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

async function pollResourceType(
	context: ClusterContext,
	resourceType: FluxResourceType
): Promise<boolean> {
	try {
		// Pass clusterId to listFluxResources to get resources from the correct cluster
		const resourceList = await listFluxResources(
			resourceType,
			context.clusterId === IN_CLUSTER_ID ? undefined : context.clusterId
		);

		if (!context.isActive) return false;

		if (resourceList && resourceList.items) {
			const shouldContinue = await processResourceItems(context, resourceType, resourceList.items);
			resourcePollsTotal.labels(context.clusterId, resourceType, 'success').inc();
			return shouldContinue;
		}

		resourcePollsTotal.labels(context.clusterId, resourceType, 'success').inc();
	} catch (err) {
		resourcePollsTotal.labels(context.clusterId, resourceType, 'error').inc();
		logger.error(
			{ clusterId: context.clusterId, resourceType, err: normalizeError(err) },
			'[EventBus] Error polling resource type'
		);
	}

	return true;
}

async function processResourceItems(
	context: ClusterContext,
	resourceType: FluxResourceType,
	items: FluxResource[]
): Promise<boolean> {
	const currentKeys = new Set<string>();

	for (const resource of items) {
		const shouldContinue = await processResource(context, resourceType, resource, currentKeys);
		if (!shouldContinue) return false;
	}

	pruneMissingResources(context, resourceType, currentKeys);
	return true;
}

async function processResource(
	context: ClusterContext,
	resourceType: FluxResourceType,
	resource: FluxResource,
	currentKeys: Set<string>
): Promise<boolean> {
	const key = buildResourceKey(resourceType, resource);
	currentKeys.add(key);

	const readyCondition = getReadyCondition(resource);

	fluxResourceStatusGauge
		.labels(
			context.clusterId,
			resourceType,
			resource.metadata.namespace || 'unknown',
			resource.metadata.name || 'unknown',
			'Ready'
		)
		.set(readyCondition?.status === 'True' ? 1 : 0);

	const currentState = buildResourceState(resource);
	const notificationState = buildNotificationState(resource);
	const previousState = context.lastStates.get(key);
	const now = Date.now();

	if (!context.resourceFirstSeen.has(key) && !context.lastStates.has(key)) {
		context.resourceFirstSeen.set(key, now);
	}

	if (!previousState) {
		if (!isResourceSettled(context, key, now)) return true;

		return handleAddedResource(context, {
			resourceType,
			resource,
			key,
			currentState,
			notificationState
		});
	}

	if (previousState !== currentState) {
		const shouldContinue = await handleModifiedResource(context, {
			resourceType,
			resource,
			key,
			currentState,
			notificationState
		});
		if (!shouldContinue) return false;
	}

	return true;
}

interface ResourceChangeDetails {
	resourceType: FluxResourceType;
	resource: FluxResource;
	key: string;
	currentState: string;
	notificationState: string;
}

async function handleAddedResource(
	context: ClusterContext,
	details: ResourceChangeDetails
): Promise<boolean> {
	const { resourceType, resource, key, currentState, notificationState } = details;

	resourceUpdatesTotal.labels(context.clusterId, resourceType, 'added').inc();
	await captureReconciliationSafely(context, resourceType, resource);

	if (!context.isActive) return false;

	broadcastResourceChange(context, 'ADDED', resourceType, resource);
	context.lastStates.set(key, currentState);
	context.lastNotificationStates.set(key, notificationState);
	context.resourceFirstSeen.delete(key);

	return true;
}

async function handleModifiedResource(
	context: ClusterContext,
	details: ResourceChangeDetails
): Promise<boolean> {
	const { resourceType, resource, key, currentState, notificationState } = details;
	const previousNotificationState = context.lastNotificationStates.get(key);

	if (!previousNotificationState || previousNotificationState !== notificationState) {
		const { shouldNotify, isTransientState } = shouldNotifyModified(
			previousNotificationState,
			notificationState
		);

		if (shouldNotify && !isTransientState) {
			resourceUpdatesTotal.labels(context.clusterId, resourceType, 'modified').inc();
			await captureReconciliationSafely(context, resourceType, resource);

			if (!context.isActive) return false;

			broadcastResourceChange(context, 'MODIFIED', resourceType, resource);
		}

		if (!isTransientState) {
			context.lastNotificationStates.set(key, notificationState);
		}
	}

	context.lastStates.set(key, currentState);
	return true;
}

function pruneMissingResources(
	context: ClusterContext,
	resourceType: FluxResourceType,
	currentKeys: Set<string>
): void {
	for (const key of Array.from(context.lastStates.keys())) {
		if (key.startsWith(`${resourceType}/`) && !currentKeys.has(key)) {
			broadcastDeletedResource(context, key);
		}
	}

	for (const key of Array.from(context.resourceFirstSeen.keys())) {
		if (key.startsWith(`${resourceType}/`) && !currentKeys.has(key)) {
			if (context.lastStates.has(key)) {
				broadcastDeletedResource(context, key);
			} else {
				cleanupResourceState(context, key);
			}
		}
	}
}

async function captureReconciliationSafely(
	context: ClusterContext,
	resourceType: FluxResourceType,
	resource: FluxResource
): Promise<void> {
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
}

function broadcastResourceChange(
	context: ClusterContext,
	type: 'ADDED' | 'MODIFIED',
	resourceType: FluxResourceType,
	resource: FluxResource
): void {
	broadcast(context, {
		type,
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

function buildResourceKey(resourceType: FluxResourceType, resource: FluxResource): string {
	return `${resourceType}/${resource.metadata.namespace}/${resource.metadata.name}`;
}

function buildResourceState(resource: FluxResource): string {
	return JSON.stringify({
		resourceVersion: resource.metadata?.resourceVersion,
		generation: resource.metadata?.generation,
		observedGeneration: resource.status?.observedGeneration
	});
}

function buildNotificationState(resource: FluxResource): string {
	const readyCondition = getReadyCondition(resource);

	return JSON.stringify({
		revision: getResourceRevision(resource),
		readyStatus: readyCondition?.status,
		readyReason: readyCondition?.reason,
		messagePreview: readyCondition?.message?.substring(0, 100) || ''
	});
}

function getReadyCondition(
	resource: FluxResource
): Pick<K8sCondition, 'type' | 'status' | 'reason' | 'message'> | undefined {
	const readyCondition = resource.status?.conditions?.find(
		(condition) => condition.type === 'Ready'
	);
	if (!readyCondition) return undefined;

	return {
		type: readyCondition.type,
		status: readyCondition.status,
		reason: readyCondition.reason,
		message: readyCondition.message
	};
}

function isResourceSettled(context: ClusterContext, key: string, now: number): boolean {
	return context.resourceFirstSeen.has(key)
		? now - context.resourceFirstSeen.get(key)! > SETTLING_PERIOD_MS
		: true;
}

function shouldNotifyModified(
	previousNotificationState: string | undefined,
	notificationState: string
): { shouldNotify: boolean; isTransientState: boolean } {
	const prevState = previousNotificationState ? JSON.parse(previousNotificationState) : {};
	const currState = JSON.parse(notificationState);

	const revisionChanged = prevState.revision !== currState.revision;
	const becameFailed = currState.readyStatus === 'False';
	const becameHealthy = prevState.readyStatus === 'False' && currState.readyStatus === 'True';
	const isTransientState = !currState.readyStatus || currState.readyStatus === 'Unknown';

	return {
		shouldNotify: revisionChanged || becameFailed || becameHealthy,
		isTransientState
	};
}

function broadcastDeletedResource(context: ClusterContext, key: string) {
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

	cleanupResourceState(context, key);
}

function cleanupResourceState(context: ClusterContext, key: string) {
	const [type, namespace, name] = key.split('/');

	fluxResourceStatusGauge.remove(context.clusterId, type, namespace, name, 'Ready');
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
