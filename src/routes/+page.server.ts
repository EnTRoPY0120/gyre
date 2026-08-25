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

function aggregateOverviewResults(overviewResults: OverviewResult[]) {
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

	return countsByKind;
}

function buildGroupCounts(overviewData: {
	results?: unknown;
	partialFailure?: boolean;
}): GroupCounts {
	const overviewResults = (overviewData.results ?? []) as OverviewResult[];
	const countsByKind = aggregateOverviewResults(overviewResults);
	const successfulTypes = new Set(countsByKind.keys());
	const groupCounts: GroupCounts = {};

	for (const group of resourceGroups) {
		const groupCount = group.resources.reduce(
			(counts, resource) => {
				const resourceCount = countsByKind.get(resource.kind);
				if (!resourceCount) {
					return counts;
				}

				counts.total += resourceCount.total;
				counts.healthy += resourceCount.healthy;
				counts.failed += resourceCount.failed;
				counts.suspended += resourceCount.suspended;
				return counts;
			},
			{ total: 0, healthy: 0, failed: 0, suspended: 0 }
		);

		groupCounts[group.name] = {
			...groupCount,
			error:
				overviewData.partialFailure === true &&
				group.resources.some((resource) => !successfulTypes.has(resource.kind))
		};
	}

	return groupCounts;
}

async function fetchGroupCounts(
	locals: App.Locals,
	requestedCluster: string
): Promise<GroupCounts> {
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

	const cacheKey = getDashboardCacheKey({
		userId: user.id,
		role: user.role,
		clusterId: requestedCluster
	});
	const cached = getDashboardCache(cacheKey);
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

	const groupCounts = buildGroupCounts(overviewData);
	setDashboardCache(cacheKey, groupCounts);
	return groupCounts;
}

export const load: PageServerLoad = async ({ locals, parent, setHeaders }) => {
	// Get health data from parent layout
	const parentData = await parent();
	const requestedCluster = locals.cluster ?? IN_CLUSTER_ID;
	const isAdmin = locals.user?.role === 'admin';

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
			groupCounts: fetchGroupCounts(locals, requestedCluster)
		}
	};
};
