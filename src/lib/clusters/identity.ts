export const IN_CLUSTER_ID = 'in-cluster';

export type ClusterId = string;

export interface ClusterOption {
	id: string;
	name: string;
	description?: string | null;
	source: 'in-cluster' | 'uploaded';
	isActive: boolean;
	currentContext?: string | null;
	connected?: boolean;
}

export function normalizeClusterId(value?: string | null): string {
	const normalized = value?.trim();
	if (!normalized || normalized === 'default' || normalized === IN_CLUSTER_ID) {
		return IN_CLUSTER_ID;
	}
	return normalized;
}

export function isInClusterId(value: string): boolean {
	return normalizeClusterId(value) === IN_CLUSTER_ID;
}
