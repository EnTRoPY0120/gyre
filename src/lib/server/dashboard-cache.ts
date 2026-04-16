import { DASHBOARD_CACHE_TTL_MS } from '$lib/server/config/constants';

const MAX_DASHBOARD_CACHE_SIZE = 50;

type DashboardEntry = { data: unknown; timestamp: number };
export interface DashboardCacheKeyParts {
	userId: string;
	role: string;
	clusterId: string;
}

const cache = new Map<string, DashboardEntry>();

export function getDashboardCacheKey({ userId, role, clusterId }: DashboardCacheKeyParts): string {
	return `dashboard:user:${userId}:role:${role}:cluster:${clusterId}`;
}

function prune(upcomingKey: string) {
	const now = Date.now();
	for (const [key, entry] of cache) {
		if (now - entry.timestamp >= DASHBOARD_CACHE_TTL_MS) {
			cache.delete(key);
		}
	}
	// Only reserve a slot when the key is new (an update keeps the same size)
	if (cache.size >= MAX_DASHBOARD_CACHE_SIZE && !cache.has(upcomingKey)) {
		const toRemove = cache.size - MAX_DASHBOARD_CACHE_SIZE + 1;
		const sorted = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
		sorted.slice(0, toRemove).forEach(([k]) => cache.delete(k));
	}
}

export function getDashboardCache(key: string): unknown | null {
	const entry = cache.get(key);
	if (!entry) return null;
	if (Date.now() - entry.timestamp >= DASHBOARD_CACHE_TTL_MS) {
		cache.delete(key);
		return null;
	}
	return entry.data;
}

export function setDashboardCache(key: string, data: unknown) {
	prune(key);
	cache.set(key, { data, timestamp: Date.now() });
}

export function invalidateDashboardCache(clusterId?: string) {
	if (clusterId === undefined) {
		cache.clear();
		return;
	}

	const suffix = `:cluster:${clusterId}`;
	for (const key of cache.keys()) {
		if (key.endsWith(suffix)) {
			cache.delete(key);
		}
	}
}
