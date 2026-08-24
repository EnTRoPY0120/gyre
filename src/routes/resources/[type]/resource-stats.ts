import type { FluxResource } from '$lib/types/flux';
import { getResourceHealth } from '$lib/utils/flux';

export interface ResourceStats {
	total: number;
	healthy: number;
	progressing: number;
	failed: number;
	suspended: number;
}

export function getResourceStats(resources: FluxResource[]): ResourceStats {
	const stats: ResourceStats = {
		total: resources.length,
		healthy: 0,
		progressing: 0,
		failed: 0,
		suspended: 0
	};

	for (const resource of resources) {
		const health = getResourceHealth(
			resource.status?.conditions,
			resource.spec?.suspend as boolean | undefined,
			resource.status?.observedGeneration,
			resource.metadata?.generation
		);

		if (health !== 'unknown') stats[health]++;
	}

	return stats;
}
