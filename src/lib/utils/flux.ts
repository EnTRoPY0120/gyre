import type { K8sCondition } from '$lib/types/flux';
import type { ResourceHealth } from '$lib/types/view';

/**
 * Determine resource health status from conditions
 */
export function getResourceHealth(
	conditions?: K8sCondition[],
	suspended?: boolean
): ResourceHealth {
	if (suspended) return 'suspended';
	if (!conditions || conditions.length === 0) return 'unknown';

	// Check Ready condition first (most important)
	const ready = conditions.find((c) => c.type === 'Ready');
	if (ready) {
		if (ready.status === 'True') return 'healthy';
		if (ready.status === 'False') {
			// Check if it's progressing or truly failed
			if (ready.reason === 'Progressing' || ready.reason === 'ProgressingWithRetry') {
				return 'progressing';
			}
			return 'failed';
		}
		if (ready.status === 'Unknown') return 'progressing';
	}

	// Check Reconciling condition
	const reconciling = conditions.find((c) => c.type === 'Reconciling');
	if (reconciling?.status === 'True') return 'progressing';

	// Check Stalled condition
	const stalled = conditions.find((c) => c.type === 'Stalled');
	if (stalled?.status === 'True') return 'failed';

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
