/**
 * View mode for resource lists
 */
export type ViewMode = 'table' | 'grid';

/**
 * Resource health status derived from conditions
 */
export type ResourceHealth = 'healthy' | 'progressing' | 'failed' | 'suspended' | 'unknown';

/**
 * A node in the Kubernetes object tree graph (for Kustomization / HelmRelease tree view)
 */
export interface GraphNode {
	id: string;
	kind: string;
	name: string;
	namespace: string;
	group: string;
	version: string;
	health: ResourceHealth;
	conditions: Array<{
		type: string;
		status: string;
		reason?: string;
		message?: string;
	}>;
	details: Record<string, unknown>;
	children: GraphNode[];
}

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
