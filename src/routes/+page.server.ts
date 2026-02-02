import type { PageServerLoad } from './$types';
import { resourceGroups } from '$lib/config/resources';

export const load: PageServerLoad = async ({ fetch, parent }) => {
	// Get health data from parent layout
	const parentData = await parent();

	// Fetch resource counts for each group
	const groupCounts: Record<
		string,
		{ total: number; healthy: number; failed: number; error: boolean }
	> = {};

	for (const group of resourceGroups) {
		let groupTotal = 0;
		let groupHealthy = 0;
		let groupFailed = 0;
		let hasError = false;

		for (const resource of group.resources) {
			try {
				const response = await fetch(`/api/flux/${resource.type}`);
				if (response.ok) {
					const data = await response.json();
					const items = data.items || [];
					groupTotal += items.length;

					// Count healthy and failed
					for (const item of items) {
						const conditions = item.status?.conditions || [];
						const ready = conditions.find((c: { type: string }) => c.type === 'Ready');
						if (ready?.status === 'True') {
							groupHealthy++;
						} else if (ready?.status === 'False') {
							groupFailed++;
						}
					}
				}
			} catch {
				hasError = true;
			}
		}

		groupCounts[group.name] = {
			total: groupTotal,
			healthy: groupHealthy,
			failed: groupFailed,
			error: hasError
		};
	}

	return {
		health: parentData.health,
		groupCounts
	};
};
