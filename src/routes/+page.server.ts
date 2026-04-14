import type { PageServerLoad } from './$types';
import { isHttpError } from '@sveltejs/kit';
import { resourceGroups } from '$lib/config/resources';
import { DASHBOARD_CACHE_TTL_MS } from '$lib/server/config/constants';
import { getDashboardCache, setDashboardCache } from '$lib/server/dashboard-cache';
import { getFluxOverviewSummary } from '$lib/server/flux/services.js';
import { requireClusterWideRead } from '$lib/server/http/guards.js';
import { AuthorizationError } from '$lib/server/kubernetes/errors.js';
import { RbacError } from '$lib/server/rbac.js';

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

function parseHttpStatus(value: unknown): number | null {
	if (typeof value === 'number') {
		return value;
	}
	if (typeof value === 'string' && /^\d+$/.test(value)) {
		return Number(value);
	}
	return null;
}

function isPermissionErrorLike(error: unknown): boolean {
	if (isHttpError(error)) {
		return error.status === 401 || error.status === 403;
	}
	if (error instanceof RbacError || error instanceof AuthorizationError) {
		return true;
	}

	if (typeof error !== 'object' || error === null) {
		return false;
	}

	const candidate = error as { code?: unknown; name?: unknown; status?: unknown };
	const statusCode = parseHttpStatus(candidate.status) ?? parseHttpStatus(candidate.code);
	if (statusCode === 401 || statusCode === 403) {
		return true;
	}

	if (typeof candidate.code === 'string') {
		const normalizedCode = candidate.code.toLowerCase();
		if (normalizedCode === 'forbidden' || normalizedCode === 'unauthorized') {
			return true;
		}
	}

	return candidate.name === 'AuthorizationError' || candidate.name === 'RbacError';
}

export const load: PageServerLoad = async ({ locals, parent, setHeaders }) => {
	// Get health data from parent layout
	const parentData = await parent();
	const requestedCluster = locals.cluster ?? '__NO_CLUSTER_SELECTED__';

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

		// Create cache key based on the requested cluster identifier, not health metadata.
		const cacheKey = `dashboard-${requestedCluster}`;
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

	return {
		health: parentData.health,
		streamed: {
			groupCounts: fetchGroupCounts()
		}
	};
};
