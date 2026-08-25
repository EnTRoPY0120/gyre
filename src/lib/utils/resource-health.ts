import type { K8sCondition } from '$lib/types/flux';
import type { ResourceHealth } from '$lib/types/view';

const HEALTH_TYPES = ['Ready', 'Healthy', 'Succeeded', 'Available'];
const PROGRESSING_REASONS = new Set([
	'Progressing',
	'ProgressingWithRetry',
	'DependencyNotReady',
	'ReconciliationInProgress'
]);

export function hasTrueCondition(conditions: K8sCondition[], types: string[]): boolean {
	return conditions.some(
		(condition) => types.includes(condition.type) && condition.status === 'True'
	);
}

export function isGenerationBehind(
	observedGeneration: number | undefined,
	generation: number | undefined
): boolean {
	return (
		generation !== undefined && observedGeneration !== undefined && observedGeneration < generation
	);
}

/** Evaluate the standard readiness condition types in their documented priority order. */
export function evaluateHealthConditions(conditions: K8sCondition[]): ResourceHealth | null {
	for (const type of HEALTH_TYPES) {
		const condition = conditions.find((candidate) => candidate.type === type);
		if (!condition) continue;
		if (condition.status === 'True') return 'healthy';
		if (condition.status === 'Unknown') return 'progressing';
		if (condition.status === 'False') {
			return PROGRESSING_REASONS.has(condition.reason ?? '') ? 'progressing' : 'failed';
		}
	}

	return null;
}
