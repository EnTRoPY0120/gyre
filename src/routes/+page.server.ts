import type { PageServerLoad } from './$types';
import { IN_CLUSTER_ID } from '$lib/clusters/identity.js';
import { resourceGroups } from '$lib/config/resources';
import { getAdminReadinessSummary } from '$lib/server/admin-readiness.js';
import { DASHBOARD_CACHE_TTL_MS } from '$lib/server/config/constants';
import {
	getDashboardCache,
	getDashboardCacheKey,
	setDashboardCache
} from '$lib/server/dashboard-cache';
import { getFluxOverviewSummary } from '$lib/server/flux/services.js';
import { requireClusterWideRead } from '$lib/server/http/guards.js';
import { isPermissionErrorLike } from '$lib/server/http/permission-errors.js';
import type { AdminReadinessSummary } from '$lib/types/admin-readiness';

type GroupCounts = Record<
	string,
	{ total: number; healthy: number; failed: number; suspended: number; error: boolean }
>;
const EMPTY_GROUP_COUNTS: GroupCounts = {};
type GroupCountValue = GroupCounts[string];
type OverviewResult = {
	type: string;
	total: number;
	healthy: number;
	failed: number;
	suspended: number;
};

export const load: PageServerLoad = async ({ locals, parent, setHeaders }) => {
	// Get health data from parent layout
	const parentData = await parent();
	const requestedCluster = locals.cluster ?? IN_CLUSTER_ID;
	const isAdmin = locals.user?.role === 'admin';

	// Function to fetch data (can be returned as a promise to be streamed)
	const fetchGroupCounts = async () => {
		try {
			await requireClusterWideRead(locals);
		} catch (error) {
			if (!isPermissionErrorLike(error)) {
				throw error;
			}
			return EMPTY_GROUP_COUNTS;
		}

		const user = locals.user;
		if (!user) {
			return EMPTY_GROUP_COUNTS;
		}

		// Scope cache by user, role, and canonical cluster ID.
		const cacheKey = getDashboardCacheKey({
			userId: user.id,
			role: user.role,
			clusterId: requestedCluster
		});
		const cached = getDashboardCache(cacheKey);

		// Return cached data if still valid
		if (cached !== null) {
			return cached as GroupCounts;
		}

		let overviewData;
		try {
			overviewData = await getFluxOverviewSummary({ locals });
		} catch (error) {
			if (!isPermissionErrorLike(error)) {
				throw error;
			}
			return EMPTY_GROUP_COUNTS;
		}

		const overviewResults = (overviewData.results ?? []) as OverviewResult[];
		const countsByKind = new Map<string, Omit<GroupCountValue, 'error'>>();

		for (const result of overviewResults) {
			const existing = countsByKind.get(result.type);
			if (existing) {
				existing.total += result.total;
				existing.healthy += result.healthy;
				existing.failed += result.failed;
				existing.suspended += result.suspended;
				continue;
			}

			countsByKind.set(result.type, {
				total: result.total,
				healthy: result.healthy,
				failed: result.failed,
				suspended: result.suspended
			});
		}

		// Build set of resource types that succeeded (absent types errored)
		const successfulTypes = new Set(countsByKind.keys());

		// Map overview results back to resourceGroups structure
		const groupCounts: GroupCounts = {};

		for (const group of resourceGroups) {
			let groupTotal = 0;
			let groupHealthy = 0;
			let groupFailed = 0;
			let groupSuspended = 0;

			for (const resInfo of group.resources) {
				const resResult = countsByKind.get(resInfo.kind);
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

	let adminReadiness: AdminReadinessSummary | undefined;
	if (isAdmin) {
		adminReadiness = await getAdminReadinessSummary({
			clusterConnected: parentData.health.connected
		});
	}

	return {
		health: parentData.health,
		adminReadiness,
		streamed: {
			groupCounts: fetchGroupCounts()
		}
	};
};
