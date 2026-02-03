import type { PageServerLoad } from './$types';
import { resourceGroups } from '$lib/config/resources';

// Cache for dashboard data - shared across requests
const dashboardCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 30 * 1000; // 30 seconds

export const load: PageServerLoad = async ({ fetch, parent, setHeaders }) => {
	// Get health data from parent layout
	const parentData = await parent();

	// Create cache key based on cluster
	const cacheKey = `dashboard-${parentData.health?.clusterName || 'default'}`;
	const cached = dashboardCache.get(cacheKey);

	// Return cached data if still valid
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		setHeaders({
			'Cache-Control': 'private, max-age=30'
		});
		return {
			health: parentData.health,
			groupCounts: cached.data as Record<
				string,
				{ total: number; healthy: number; failed: number; error: boolean }
			>,
			cached: true
		};
	}

	// Fetch resource counts for each group in parallel
	const groupCounts: Record<
		string,
		{ total: number; healthy: number; failed: number; error: boolean }
	> = {};

	// Fetch all groups in parallel for better performance
	await Promise.all(
		resourceGroups.map(async (group) => {
			let groupTotal = 0;
			let groupHealthy = 0;
			let groupFailed = 0;
			let hasError = false;

			// Fetch all resources in a group in parallel
			await Promise.all(
				group.resources.map(async (resource) => {
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
				})
			);

			groupCounts[group.name] = {
				total: groupTotal,
				healthy: groupHealthy,
				failed: groupFailed,
				error: hasError
			};
		})
	);

	// Store in cache
	dashboardCache.set(cacheKey, { data: groupCounts, timestamp: Date.now() });

	setHeaders({
		'Cache-Control': 'private, max-age=30'
	});

	return {
		health: parentData.health,
		groupCounts,
		cached: false
	};
};
