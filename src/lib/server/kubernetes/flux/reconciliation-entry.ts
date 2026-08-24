import type { NewReconciliationHistory } from '../../db/index.js';
import type { FluxResource, K8sCondition } from './types.js';
import type { FluxResourceType } from './resources.js';

export interface CaptureReconciliationOptions {
	resourceType: FluxResourceType;
	namespace: string;
	name: string;
	clusterId: string;
	/** Full resource state for outcome events. Omit for trigger-only entries
	 *  (e.g. manual reconcile) where no outcome is available yet. */
	resource?: FluxResource;
	triggerType?: 'automatic' | 'manual' | 'webhook' | 'rollback';
	triggeredByUserId?: string | null;
}

type OutcomeCaptureOptions = CaptureReconciliationOptions & { resource: FluxResource };

function getResourceRevision(resource: FluxResource): string {
	return (
		resource.status?.lastAppliedRevision ||
		resource.status?.artifact?.revision ||
		resource.status?.lastAttemptedRevision ||
		''
	);
}

function getPreviousRevision(resource: FluxResource): string | null {
	return resource.status?.lastAttemptedRevision || null;
}

function determineStatus(
	readyCondition: K8sCondition | undefined
): 'success' | 'failure' | 'unknown' {
	if (!readyCondition) return 'unknown';
	if (readyCondition.status === 'True') return 'success';
	if (readyCondition.status === 'False') return 'failure';
	return 'unknown';
}

function getReconcileStartTime(resource: FluxResource): Date | null {
	const readyCondition = resource.status?.conditions?.find(
		(condition) => condition.type === 'Ready'
	);
	if (readyCondition?.lastTransitionTime) {
		return new Date(readyCondition.lastTransitionTime);
	}
	return null;
}

function getReconcileCompletedTime(resource: FluxResource): Date {
	if (resource.status?.artifact?.lastUpdateTime) {
		return new Date(resource.status.artifact.lastUpdateTime);
	}

	const readyCondition = resource.status?.conditions?.find(
		(condition) => condition.type === 'Ready'
	);
	if (readyCondition?.lastTransitionTime) {
		return new Date(readyCondition.lastTransitionTime);
	}

	return new Date();
}

function calculateDuration(resource: FluxResource): number | null {
	const startTime = getReconcileStartTime(resource);
	const endTime = getReconcileCompletedTime(resource);
	if (!startTime) return null;

	const durationMs = endTime.getTime() - startTime.getTime();
	if (durationMs < 0) return null;
	if (
		durationMs === 0 &&
		(!resource.status?.artifact || !resource.status.artifact.lastUpdateTime)
	) {
		return null;
	}
	return durationMs;
}

function getStalledReason(resource: FluxResource): string | null {
	const stalledCondition = resource.status?.conditions?.find(
		(condition) => condition.type === 'Stalled'
	);
	if (stalledCondition?.status === 'True') {
		return stalledCondition.reason || 'Stalled';
	}
	return null;
}

export function buildOutcomeEntry(options: OutcomeCaptureOptions): NewReconciliationHistory {
	const readyCondition = options.resource.status?.conditions?.find(
		(condition) => condition.type === 'Ready'
	);
	const status = determineStatus(readyCondition);

	return {
		id: crypto.randomUUID(),
		resourceType: options.resourceType,
		namespace: options.namespace,
		name: options.name,
		clusterId: options.clusterId,
		revision: getResourceRevision(options.resource) || null,
		previousRevision: getPreviousRevision(options.resource),
		status,
		readyStatus: readyCondition?.status || null,
		readyReason: readyCondition?.reason || null,
		readyMessage: readyCondition?.message || null,
		reconcileStartedAt: getReconcileStartTime(options.resource),
		reconcileCompletedAt: getReconcileCompletedTime(options.resource),
		durationMs: calculateDuration(options.resource),
		specSnapshot: options.resource.spec ? JSON.stringify(options.resource.spec) : null,
		metadataSnapshot: JSON.stringify({
			labels: options.resource.metadata.labels || {},
			annotations: options.resource.metadata.annotations || {}
		}),
		triggerType: options.triggerType || 'automatic',
		triggeredByUser: options.triggeredByUserId || null,
		errorMessage: status === 'failure' && readyCondition?.message ? readyCondition.message : null,
		stalledReason: getStalledReason(options.resource)
	};
}

export function buildTriggerEntry(options: CaptureReconciliationOptions): NewReconciliationHistory {
	return {
		id: crypto.randomUUID(),
		resourceType: options.resourceType,
		namespace: options.namespace,
		name: options.name,
		clusterId: options.clusterId,
		revision: null,
		previousRevision: null,
		status: 'unknown',
		readyStatus: null,
		readyReason: null,
		readyMessage: null,
		reconcileStartedAt: null,
		reconcileCompletedAt: new Date(),
		durationMs: null,
		specSnapshot: null,
		metadataSnapshot: null,
		triggerType: options.triggerType || 'manual',
		triggeredByUser: options.triggeredByUserId || null,
		errorMessage: null,
		stalledReason: null
	};
}
