import type { K8sCondition } from '$lib/types/flux';
import type { ResourceHealth } from '$lib/types/view';

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

	// 1. Check observedGeneration vs generation
	// If generation is known and observedGeneration is behind, it's progressing
	if (
		generation !== undefined &&
		observedGeneration !== undefined &&
		observedGeneration < generation
	) {
		return 'progressing';
	}

	if (!conditions || conditions.length === 0) return 'unknown';

	// 2. Check for Stalled/Failed conditions (highest priority)
	const stalled = conditions.find((c) => c.type === 'Stalled' || c.type === 'Failed');
	if (stalled?.status === 'True') return 'failed';

	// 3. Check for Ready/Healthy indicators
	// Priority order: Ready, Healthy, Succeeded, Available
	const healthTypes = ['Ready', 'Healthy', 'Succeeded', 'Available'];
	for (const type of healthTypes) {
		const condition = conditions.find((c) => c.type === type);
		if (condition) {
			if (condition.status === 'True') return 'healthy';
			if (condition.status === 'False') {
				// Some resources use Ready=False with Progressing reason
				if (
					condition.reason === 'Progressing' ||
					condition.reason === 'ProgressingWithRetry' ||
					condition.reason === 'DependencyNotReady' ||
					condition.reason === 'ReconciliationInProgress'
				) {
					return 'progressing';
				}
				// If it's False but not a known progressing reason, it's failed
				// (unless another condition says otherwise, but usually Ready is authoritative)
				return 'failed';
			}
			if (condition.status === 'Unknown') return 'progressing';
		}
	}

	// 4. Check Reconciling condition
	const reconciling = conditions.find((c) => c.type === 'Reconciling');
	if (reconciling?.status === 'True') return 'progressing';

	// 5. Special case for some resources that might not have the above
	// but have some other indicator of success
	const validated = conditions.find((c) => c.type === 'Validated' || c.type === 'Valid');
	if (validated?.status === 'True') return 'healthy';

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
 * Format FluxCD interval string (e.g., "5m", "1h", "24h")
 */
export function formatInterval(interval?: string): string {
	if (!interval) return 'Not set';

	// Interval is already in a readable format (e.g., "5m", "1h30m")
	return interval;
}

/**
 * Get health badge color
 */
export function getHealthColor(health: ResourceHealth): string {
	switch (health) {
		case 'healthy':
			return 'green';
		case 'progressing':
			return 'blue';
		case 'failed':
			return 'red';
		case 'suspended':
			return 'gray';
		default:
			return 'gray';
	}
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

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return text.substring(0, maxLength - 3) + '...';
}
