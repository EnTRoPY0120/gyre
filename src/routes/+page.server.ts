import type { PageServerLoad } from './$types';
import { resourceGroups } from '$lib/config/resources';
import { DASHBOARD_CACHE_TTL_MS } from '$lib/server/config/constants';
import { getDashboardCache, setDashboardCache } from '$lib/server/dashboard-cache';
import { getFluxOverviewSummary } from '$lib/server/flux/services.js';
import { requireClusterWideRead } from '$lib/server/http/guards.js';

export const load: PageServerLoad = async ({ locals, parent, setHeaders }) => {
	// Get health data from parent layout
	const parentData = await parent();

	// Function to fetch data (can be returned as a promise to be streamed)
	const fetchGroupCounts = async () => {
		try {
			await requireClusterWideRead(locals);
		} catch {
			return {} as Record<
				string,
				{ total: number; healthy: number; failed: number; suspended: number; error: boolean }
			>;
		}

		// Create cache key based on cluster
		const cacheKey = `dashboard-${parentData.health?.clusterName || 'default'}`;
		const cached = getDashboardCache(cacheKey);

		// Return cached data if still valid
		if (cached !== null) {
			return cached as Record<
				string,
				{ total: number; healthy: number; failed: number; suspended: number; error: boolean }
			>;
		}

		let overviewData;
		try {
			overviewData = await getFluxOverviewSummary({ locals });
		} catch {
			return {} as Record<
				string,
				{ total: number; healthy: number; failed: number; suspended: number; error: boolean }
			>;
		}

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
