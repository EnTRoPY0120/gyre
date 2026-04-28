import { IN_CLUSTER_ID, normalizeClusterId } from '$lib/clusters/identity.js';
import { eventsStore } from './events.svelte';
import { clusterStore } from './cluster.svelte';
import { resolveResourceRouteType } from '$lib/config/resources';
import type { FluxResource } from '$lib/types/flux';
import { fetchWithRetry } from '$lib/utils/fetch';
import { logger } from '$lib/utils/logger.js';

const MAX_RESOURCE_ENTRIES = 500;
const MAX_LIST_ENTRIES = 100;

interface CacheEntry<T> {
	data: T;
	timestamp: number;
	lastAccess: number;
}

class ResourceCacheStore {
	private resourceCache = $state<Record<string, CacheEntry<FluxResource>>>({});
	private listCache = $state<Record<string, CacheEntry<FluxResource[]>>>({});
	private ttl = 30000;

	private getCurrentClusterId(): string {
		return normalizeClusterId(clusterStore.current ?? IN_CLUSTER_ID);
	}

	private normalizeType(type: string): string {
		return resolveResourceRouteType(type) ?? type;
	}

	constructor() {
		if (typeof window !== 'undefined') {
			this.setupRealtimeInvalidation();
		}
	}

	private setupRealtimeInvalidation() {
		eventsStore.onEvent((event) => {
			if (!event.resource || !event.resourceType) return;

			const { name, namespace } = event.resource.metadata;
			const type = event.resourceType;
			const clusterId = normalizeClusterId(event.clusterId ?? IN_CLUSTER_ID);

			// Invalidate specific resource
			this.invalidateResource(type, namespace, name, clusterId);

			// Invalidate global list and namespace-specific list
			this.invalidateList(type, undefined, clusterId);
			if (namespace) {
				this.invalidateList(type, namespace, clusterId);
			}
		});
	}

	private getResourceKey(
		type: string,
		namespace: string,
		name: string,
		clusterId = this.getCurrentClusterId()
	): string {
		return `${clusterId}:${this.normalizeType(type)}:${namespace}:${name}`;
	}

	private getListKey(
		type: string,
		namespace?: string,
		clusterId = this.getCurrentClusterId()
	): string {
		const normalizedType = this.normalizeType(type);
		return namespace
			? `${clusterId}:${normalizedType}:${namespace}`
			: `${clusterId}:${normalizedType}`;
	}

	private getCachedResourceEntry(type: string, namespace: string, name: string) {
		return this.resourceCache[this.getResourceKey(type, namespace, name)] ?? null;
	}

	private getCachedListEntry(type: string, namespace?: string) {
		return this.listCache[this.getListKey(type, namespace)] ?? null;
	}

	private pruneEntries<T>(cache: Record<string, CacheEntry<T>>, maxSize: number): void {
		const now = Date.now();

		// First pass: remove all expired entries
		for (const key of Object.keys(cache)) {
			if (now - cache[key].timestamp >= this.ttl) {
				delete cache[key];
			}
		}

		// Second pass: if still over limit, batch-evict bottom 20% by lastAccess
		const keys = Object.keys(cache);
		if (keys.length > maxSize) {
			const evictCount = Math.max(1, Math.ceil(keys.length * 0.2));
			keys
				.sort((a, b) => cache[a].lastAccess - cache[b].lastAccess)
				.slice(0, evictCount)
				.forEach((k) => delete cache[k]);
		}
	}

	getResource(type: string, namespace: string, name: string): FluxResource | null {
		const entry = this.getCachedResourceEntry(type, namespace, name);

		if (entry && Date.now() - entry.timestamp < this.ttl) {
			return entry.data;
		}

		return null;
	}

	setResource(type: string, namespace: string, name: string, resource: FluxResource) {
		const key = this.getResourceKey(type, namespace, name);
		const now = Date.now();
		this.resourceCache[key] = { data: resource, timestamp: now, lastAccess: now };

		if (Object.keys(this.resourceCache).length > MAX_RESOURCE_ENTRIES) {
			this.pruneEntries(this.resourceCache, MAX_RESOURCE_ENTRIES);
		}
	}

	getList(type: string, namespace?: string): FluxResource[] | null {
		const entry = this.getCachedListEntry(type, namespace);

		if (entry && Date.now() - entry.timestamp < this.ttl) {
			return entry.data;
		}

		return null;
	}

	setList(type: string, items: FluxResource[], namespace?: string) {
		const key = this.getListKey(type, namespace);
		const now = Date.now();
		this.listCache[key] = { data: items, timestamp: now, lastAccess: now };

		if (Object.keys(this.listCache).length > MAX_LIST_ENTRIES) {
			this.pruneEntries(this.listCache, MAX_LIST_ENTRIES);
		}

		items.forEach((item) => {
			// Use undefined for cluster-scoped resources (no namespace) instead of 'default'
			const ns = item.metadata.namespace ?? undefined;
			if (ns !== undefined) {
				this.setResource(type, ns, item.metadata.name, item);
			}
		});
	}

	invalidateResource(type: string, namespace: string, name: string, clusterId?: string) {
		const key = this.getResourceKey(type, namespace, name, clusterId);
		delete this.resourceCache[key];
	}

	invalidateList(type: string, namespace?: string, clusterId?: string) {
		const key = this.getListKey(type, namespace, clusterId);
		delete this.listCache[key];
	}

	clear() {
		this.resourceCache = {};
		this.listCache = {};
	}

	async fetchList(type: string, namespace?: string): Promise<FluxResource[]> {
		const normalizedType = this.normalizeType(type);
		const staleEntry = this.getCachedListEntry(normalizedType, namespace);
		const url = namespace
			? `/api/v1/flux/${encodeURIComponent(normalizedType)}?namespace=${encodeURIComponent(namespace)}`
			: `/api/v1/flux/${encodeURIComponent(normalizedType)}`;
		try {
			const res = await fetchWithRetry(url);
			if (!res.ok) {
				if (res.status >= 400 && res.status < 500) {
					this.setList(normalizedType, [], namespace);
					return [];
				}

				throw new Error(`Failed to fetch ${normalizedType} list: ${res.status}`);
			}
			const data = await res.json();
			const items = data.items || [];
			this.setList(normalizedType, items, namespace);
			return items;
		} catch (err) {
			logger.error(err, `Error fetching ${normalizedType} list:`);
			return staleEntry?.data ?? [];
		}
	}

	async fetchResource(type: string, namespace: string, name: string): Promise<FluxResource | null> {
		const normalizedType = this.normalizeType(type);
		const staleEntry = this.getCachedResourceEntry(normalizedType, namespace, name);
		try {
			const res = await fetchWithRetry(
				`/api/v1/flux/${encodeURIComponent(normalizedType)}/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`
			);
			if (!res.ok) {
				if (res.status >= 400 && res.status < 500) {
					this.invalidateResource(normalizedType, namespace, name);
					return null;
				}

				throw new Error(`Failed to fetch ${normalizedType}/${namespace}/${name}: ${res.status}`);
			}
			const resource = await res.json();
			this.setResource(normalizedType, namespace, name, resource);
			return resource;
		} catch (err) {
			logger.error(err, `Error fetching resource ${normalizedType}/${namespace}/${name}:`);
			return staleEntry?.data ?? null;
		}
	}
}

export const resourceCache = new ResourceCacheStore();
