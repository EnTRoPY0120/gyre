import { DASHBOARD_CACHE_TTL_MS } from '$lib/server/config/constants';

const MAX_DASHBOARD_CACHE_SIZE = 50;

export const dashboardCache = new Map<string, { data: unknown; timestamp: number }>();

export function pruneDashboardCache() {
	const now = Date.now();
	for (const [key, entry] of dashboardCache) {
		if (now - entry.timestamp >= DASHBOARD_CACHE_TTL_MS) {
			dashboardCache.delete(key);
		}
	}
	if (dashboardCache.size > MAX_DASHBOARD_CACHE_SIZE) {
		const sorted = [...dashboardCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
		sorted
			.slice(0, dashboardCache.size - MAX_DASHBOARD_CACHE_SIZE)
			.forEach(([k]) => dashboardCache.delete(k));
	}
}

export function invalidateDashboardCache(clusterName?: string) {
	if (clusterName !== undefined) {
		dashboardCache.delete(`dashboard-${clusterName}`);
	} else {
		dashboardCache.clear();
	}
}
