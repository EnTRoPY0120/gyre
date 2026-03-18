/**
 * View mode for resource lists
 */
export type ViewMode = 'table' | 'grid';

/**
 * Resource health status derived from conditions
 */
export type ResourceHealth = 'healthy' | 'progressing' | 'failed' | 'suspended' | 'unknown';
export const RESOURCE_HEALTH_VALUES: ReadonlyArray<ResourceHealth> = [
	'healthy',
	'progressing',
	'failed',
	'suspended',
	'unknown'
];

/**
 * User preferences for UI
 */
export interface ViewPreferences {
	viewMode: ViewMode;
	showNamespace: boolean;
	compactMode: boolean;
	autoRefresh: boolean;
	refreshInterval: number; // in seconds
	itemsPerPage: number;
}
