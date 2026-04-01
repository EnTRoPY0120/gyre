import { eventsStore } from './events.svelte';
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

			// Invalidate specific resource
			this.invalidateResource(type, namespace, name);

			// Invalidate global list and namespace-specific list
			this.invalidateList(type);
			if (namespace) {
				this.invalidateList(type, namespace);
			}
		});
	}

	private getResourceKey(type: string, namespace: string, name: string): string {
		return `${type}:${namespace}:${name}`;
	}

	private getListKey(type: string, namespace?: string): string {
		return namespace ? `${type}:${namespace}` : type;
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
		const key = this.getResourceKey(type, namespace, name);
		const entry = this.resourceCache[key];

		if (entry && Date.now() - entry.timestamp < this.ttl) {
			entry.lastAccess = Date.now();
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
		const key = this.getListKey(type, namespace);
		const entry = this.listCache[key];

		if (entry && Date.now() - entry.timestamp < this.ttl) {
			entry.lastAccess = Date.now();
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

	invalidateResource(type: string, namespace: string, name: string) {
		const key = this.getResourceKey(type, namespace, name);
		delete this.resourceCache[key];
	}

	invalidateList(type: string, namespace?: string) {
		const key = this.getListKey(type, namespace);
		delete this.listCache[key];
	}

	clear() {
		this.resourceCache = {};
		this.listCache = {};
	}

	async fetchList(type: string, namespace?: string): Promise<FluxResource[]> {
		const url = namespace
			? `/api/v1/flux/${encodeURIComponent(type)}?namespace=${encodeURIComponent(namespace)}`
			: `/api/v1/flux/${encodeURIComponent(type)}`;
		try {
			const res = await fetchWithRetry(url);
			if (!res.ok) throw new Error(`Failed to fetch ${type} list`);
			const data = await res.json();
			const items = data.items || [];
			this.setList(type, items, namespace);
			return items;
		} catch (err) {
			logger.error(err, `Error fetching ${type} list:`);
			return [];
		}
	}

	async fetchResource(type: string, namespace: string, name: string): Promise<FluxResource | null> {
		try {
			const res = await fetchWithRetry(`/api/v1/flux/${type}/${namespace}/${name}`);
			if (!res.ok) throw new Error(`Failed to fetch ${type}/${namespace}/${name}`);
			const resource = await res.json();
			this.setResource(type, namespace, name, resource);
			return resource;
		} catch (err) {
			logger.error(err, `Error fetching resource ${type}/${namespace}/${name}:`);
			return null;
		}
	}
}

export const resourceCache = new ResourceCacheStore();
