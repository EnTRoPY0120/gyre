import { DASHBOARD_CACHE_TTL_MS } from '$lib/server/config/constants';

const MAX_DASHBOARD_CACHE_SIZE = 50;

type DashboardEntry = { data: unknown; timestamp: number };

const cache = new Map<string, DashboardEntry>();

function prune() {
	const now = Date.now();
	for (const [key, entry] of cache) {
		if (now - entry.timestamp >= DASHBOARD_CACHE_TTL_MS) {
			cache.delete(key);
		}
	}
	// Reserve a slot for the upcoming insert so the size never exceeds MAX
	if (cache.size >= MAX_DASHBOARD_CACHE_SIZE) {
		const toRemove = cache.size - MAX_DASHBOARD_CACHE_SIZE + 1;
		const sorted = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
		sorted.slice(0, toRemove).forEach(([k]) => cache.delete(k));
	}
}

export function getDashboardCache(key: string): unknown | null {
	const entry = cache.get(key);
	if (entry && Date.now() - entry.timestamp < DASHBOARD_CACHE_TTL_MS) {
		return entry.data;
	}
	return null;
}

export function setDashboardCache(key: string, data: unknown) {
	prune();
	cache.set(key, { data, timestamp: Date.now() });
}

export function invalidateDashboardCache(clusterName?: string) {
	if (clusterName !== undefined) {
		cache.delete(`dashboard-${clusterName}`);
	} else {
		cache.clear();
	}
}
