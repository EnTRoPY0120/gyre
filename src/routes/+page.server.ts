import type { PageServerLoad } from './$types';
import { resourceGroups } from '$lib/config/resources';
import { logger } from '$lib/server/logger.js';
import { fetchWithRetry } from '$lib/utils/fetch';
import { DASHBOARD_CACHE_TTL_MS } from '$lib/server/config/constants';
import { getDashboardCache, setDashboardCache } from '$lib/server/dashboard-cache';

export const load: PageServerLoad = async ({ fetch: svelteFetch, parent, setHeaders }) => {
	// Get health data from parent layout
	const parentData = await parent();

	// Function to fetch data (can be returned as a promise to be streamed)
	const fetchGroupCounts = async () => {
		// Create cache key based on cluster
		const cacheKey = `dashboard-${parentData.health?.clusterName || 'default'}`;
		const cached = getDashboardCache(cacheKey);

		// Return cached data if still valid
		if (cached) {
			return cached as Record<
				string,
				{ total: number; healthy: number; failed: number; suspended: number; error: boolean }
			>;
		}

		// Fetch batched overview results
		const response = await fetchWithRetry('/api/v1/flux/overview', undefined, {
			fetchFn: svelteFetch,
			logger
		});
		if (!response.ok) {
			return {} as Record<
				string,
				{ total: number; healthy: number; failed: number; suspended: number; error: boolean }
			>;
		}

		const overviewData = await response.json();
		const results = overviewData.results || [];

		// Build set of resource types that succeeded (absent types errored)
		const successfulTypes = new Set(results.map((r: { type: string }) => r.type));

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

			for (const resInfo of group.resources) {
				const resResult = results.find(
					(r: {
						type: string;
						total: number;
						healthy: number;
						failed: number;
						suspended: number;
					}) => r.type === resInfo.kind
				);
				if (resResult) {
					groupTotal += resResult.total;
					groupHealthy += resResult.healthy;
					groupFailed += resResult.failed;
					groupSuspended += resResult.suspended;
				}
			}

			groupCounts[group.name] = {
				total: groupTotal,
				healthy: groupHealthy,
				failed: groupFailed,
				suspended: groupSuspended,
				error:
					overviewData.partialFailure === true &&
					group.resources.some((r) => !successfulTypes.has(r.kind))
			};
		}

		setDashboardCache(cacheKey, groupCounts);
		return groupCounts;
	};

	setHeaders({
		'Cache-Control': `private, max-age=${Math.floor(DASHBOARD_CACHE_TTL_MS / 1000)}`
	});

	return {
		health: parentData.health,
		streamed: {
			groupCounts: fetchGroupCounts()
		}
	};
};
