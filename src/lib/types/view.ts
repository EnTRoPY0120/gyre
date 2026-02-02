/**
 * View mode for resource lists
 */
export type ViewMode = 'table' | 'grid';

/**
 * Resource health status derived from conditions
 */
export type ResourceHealth = 'healthy' | 'progressing' | 'failed' | 'suspended' | 'unknown';

/**
 * User preferences for UI
 */
export interface ViewPreferences {
	viewMode: ViewMode;
	showNamespace: boolean;
	compactMode: boolean;
	autoRefresh: boolean;
	refreshInterval: number; // in seconds
}
