import type { PageServerLoad } from './$types';
import { resourceGroups } from '$lib/config/resources';
import { fetchWithRetry } from '$lib/utils/fetch';
import { DASHBOARD_CACHE_TTL_MS } from '$lib/server/config/constants';

// Cache for dashboard data - shared across requests
const dashboardCache = new Map<string, { data: unknown; timestamp: number }>();

export const load: PageServerLoad = async ({ fetch: svelteFetch, parent, setHeaders }) => {
	// Get health data from parent layout
	const parentData = await parent();

	// Function to fetch data (can be returned as a promise to be streamed)
	const fetchGroupCounts = async () => {
		// Create cache key based on cluster
		const cacheKey = `dashboard-${parentData.health?.clusterName || 'default'}`;
		const cached = dashboardCache.get(cacheKey);

		// Return cached data if still valid
		if (cached && Date.now() - cached.timestamp < DASHBOARD_CACHE_TTL_MS) {
			return cached.data as Record<
				string,
				{ total: number; healthy: number; failed: number; suspended: number; error: boolean }
			>;
		}

		// Fetch batched overview results
		const response = await fetchWithRetry('/api/flux/overview', undefined, {
			fetchFn: svelteFetch
		});
		if (!response.ok) {
			return {} as Record<
				string,
				{ total: number; healthy: number; failed: number; suspended: number; error: boolean }
			>;
		}

		const overviewData = await response.json();
		const results = overviewData.results || [];

		// Map overview results back to resourceGroups structure
		const groupCounts: Record<
			string,
			{ total: number; healthy: number; failed: number; suspended: number; error: boolean }
		> = {};

		for (const group of resourceGroups) {
			let groupTotal = 0;
			let groupHealthy = 0;
			let groupFailed = 0;
			let groupSuspended = 0;
			let hasError = false;

			for (const resInfo of group.resources) {
				const resResult = results.find(
					(r: {
						type: string;
						total: number;
						healthy: number;
						failed: number;
						suspended: number;
						error: boolean;
					}) => r.type === resInfo.kind
				);
				if (resResult) {
					groupTotal += resResult.total;
					groupHealthy += resResult.healthy;
					groupFailed += resResult.failed;
					groupSuspended += resResult.suspended;
					if (resResult.error) hasError = true;
				}
			}

			groupCounts[group.name] = {
				total: groupTotal,
				healthy: groupHealthy,
				failed: groupFailed,
				suspended: groupSuspended,
				error: hasError
			};
		}

		// Store in cache
		dashboardCache.set(cacheKey, { data: groupCounts, timestamp: Date.now() });
		return groupCounts;
	};

	setHeaders({
		'Cache-Control': 'private, max-age=30'
	});

	return {
		health: parentData.health,
		streamed: {
			groupCounts: fetchGroupCounts()
		}
	};
};
