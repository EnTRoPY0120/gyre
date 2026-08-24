import type { K8sCondition } from '$lib/types/flux';
import type { ResourceHealth } from '$lib/types/view';
import {
	evaluateHealthConditions,
	hasTrueCondition,
	isGenerationBehind
} from './resource-health.js';

// Re-export for external use
export type { ResourceHealth } from '$lib/types/view';

/**
 * Determine resource health status from conditions and generation metadata
 */
export function getResourceHealth(
	conditions?: K8sCondition[],
	suspended?: boolean,
	observedGeneration?: number,
	generation?: number
): ResourceHealth {
	if (suspended) return 'suspended';

	if (!conditions || conditions.length === 0) return 'unknown';

	if (hasTrueCondition(conditions, ['Stalled', 'Failed'])) return 'failed';

	if (isGenerationBehind(observedGeneration, generation)) return 'progressing';

	const health = evaluateHealthConditions(conditions);
	if (health) return health;

	if (hasTrueCondition(conditions, ['Reconciling'])) return 'progressing';

	if (hasTrueCondition(conditions, ['Validated', 'Valid'])) return 'healthy';

	return 'unknown';
}

/**
 * Format timestamp to human-readable relative time
 */
export function formatTimestamp(timestamp?: string): string {
	if (!timestamp) return 'Never';

	const now = new Date();
	const then = new Date(timestamp);
	const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

	if (seconds < 60) return `${seconds}s ago`;
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
	if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
	if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
	if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;
	if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo ago`;
	return `${Math.floor(seconds / 31536000)}y ago`;
}

/**
 * Get health badge label
 */
export function getHealthLabel(health: ResourceHealth): string {
	switch (health) {
		case 'healthy':
			return 'Ready';
		case 'progressing':
			return 'Progressing';
		case 'failed':
			return 'Failed';
		case 'suspended':
			return 'Suspended';
		default:
			return 'Unknown';
	}
}
