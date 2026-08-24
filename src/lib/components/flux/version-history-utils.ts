import { formatDuration, intervalToDuration } from 'date-fns';

export function getStatusDotClass(status: string): string {
	switch (status) {
		case 'success':
			return 'bg-green-500 ring-green-500/30';
		case 'failure':
			return 'bg-red-500 ring-red-500/30';
		default:
			return 'bg-gray-400 ring-gray-400/30';
	}
}

export function getStatusBadgeClass(status: string): string {
	switch (status) {
		case 'success':
			return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
		case 'failure':
			return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
		default:
			return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
	}
}

export function getTriggerBadgeClass(triggerType: string): string {
	switch (triggerType) {
		case 'manual':
			return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
		case 'webhook':
			return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
		case 'rollback':
			return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
		default:
			return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
	}
}

export function formatDurationMs(ms: number | null): string {
	if (ms == null) return 'N/A';
	const duration = intervalToDuration({ start: 0, end: ms });
	return formatDuration(duration, { format: ['minutes', 'seconds'] }) || `${ms}ms`;
}
