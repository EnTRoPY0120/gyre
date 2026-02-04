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

	// Fetch batched overview results
	const response = await fetch('/api/flux/overview');
	if (!response.ok) {
		return { health: parentData.health, groupCounts: {}, error: true };
	}

	const overviewData = await response.json();
	const results = overviewData.results || [];

	// Map overview results back to resourceGroups structure
	const groupCounts: Record<
		string,
		{ total: number; healthy: number; failed: number; error: boolean }
	> = {};

	for (const group of resourceGroups) {
		let groupTotal = 0;
		let groupHealthy = 0;
		let groupFailed = 0;
		let hasError = false;

		for (const resInfo of group.resources) {
			const resResult = results.find(
				(r: { type: string; total: number; healthy: number; failed: number; error: boolean }) =>
					r.type === resInfo.kind
			);
			if (resResult) {
				groupTotal += resResult.total;
				groupHealthy += resResult.healthy;
				groupFailed += resResult.failed;
				if (resResult.error) hasError = true;
			}
		}

		groupCounts[group.name] = {
			total: groupTotal,
			healthy: groupHealthy,
			failed: groupFailed,
			error: hasError
		};
	}

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
