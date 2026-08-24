import type { FluxResource, K8sCondition } from './types.js';

export type ResourceStatus = 'failed' | 'progressing' | 'suspended' | 'unknown' | 'healthy';

const PRIORITY_CONDITION_TYPES = ['Ready', 'Healthy', 'Succeeded', 'Available'];
const PROGRESSING_REASONS = new Set([
	'Progressing',
	'ProgressingWithRetry',
	'DependencyNotReady',
	'ReconciliationInProgress'
]);

function hasStalledFailure(conditions: K8sCondition[]): boolean {
	const stalled = conditions.find(
		(condition) => condition.type === 'Stalled' || condition.type === 'Failed'
	);
	return stalled?.status === 'True';
}

function isGenerationProgressing(resource: FluxResource): boolean {
	const generation = resource.metadata.generation;
	const observedGeneration = resource.status?.observedGeneration;
	return (
		generation !== undefined && observedGeneration !== undefined && observedGeneration < generation
	);
}

function getConditionStatus(conditions: K8sCondition[]): ResourceStatus | undefined {
	for (const type of PRIORITY_CONDITION_TYPES) {
		const condition = conditions.find((candidate) => candidate.type === type);
		if (!condition) continue;
		if (condition.status === 'True') return 'healthy';
		if (condition.status !== 'False') continue;
		if (condition.reason && PROGRESSING_REASONS.has(condition.reason)) return 'progressing';
		return 'failed';
	}

	return undefined;
}

/** Apply Flux condition precedence to the status used by list sorting and filters. */
export function getResourceStatus(resource: FluxResource): ResourceStatus {
	if (resource.spec?.suspend) return 'suspended';

	const conditions = resource.status?.conditions;
	if (!conditions || conditions.length === 0) return 'unknown';
	if (hasStalledFailure(conditions)) return 'failed';
	if (isGenerationProgressing(resource)) return 'progressing';

	return getConditionStatus(conditions) ?? 'unknown';
}
