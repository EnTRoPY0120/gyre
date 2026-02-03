import { websocketStore } from './websocket.svelte';
import type { FluxResource, FluxResourceType } from '$lib/types/flux';

interface CacheEntry<T> {
	data: T;
	timestamp: number;
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
		websocketStore.onEvent((event) => {
			if (!event.resource || !event.resourceType) return;

			const { name, namespace } = event.resource.metadata;
			const type = event.resourceType;

			// Invalidate specific resource
			this.invalidateResource(type, namespace, name);

			// Invalidate lists
			this.invalidateList(type);
		});
	}

	private getResourceKey(type: string, namespace: string, name: string): string {
		return `${type}:${namespace}:${name}`;
	}

	private getListKey(type: string, namespace?: string): string {
		return namespace ? `${type}:${namespace}` : type;
	}

	getResource(type: string, namespace: string, name: string): FluxResource | null {
		const key = this.getResourceKey(type, namespace, name);
		const entry = this.resourceCache[key];

		if (entry && Date.now() - entry.timestamp < this.ttl) {
			return entry.data;
		}

		return null;
	}

	setResource(type: string, namespace: string, name: string, resource: FluxResource) {
		const key = this.getResourceKey(type, namespace, name);
		this.resourceCache[key] = {
			data: resource,
			timestamp: Date.now()
		};
	}

	getList(type: string, namespace?: string): FluxResource[] | null {
		const key = this.getListKey(type, namespace);
		const entry = this.listCache[key];

		if (entry && Date.now() - entry.timestamp < this.ttl) {
			return entry.data;
		}

		return null;
	}

	setList(type: string, items: FluxResource[], namespace?: string) {
		const key = this.getListKey(type, namespace);
		this.listCache[key] = {
			data: items,
			timestamp: Date.now()
		};

		items.forEach((item) => {
			this.setResource(type, item.metadata.namespace || 'default', item.metadata.name, item);
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
		const url = namespace ? `/api/flux/${type}?namespace=${namespace}` : `/api/flux/${type}`;
		try {
			const res = await fetch(url);
			if (!res.ok) throw new Error(`Failed to fetch ${type} list`);
			const data = await res.json();
			const items = data.resources || [];
			this.setList(type, items, namespace);
			return items;
		} catch (err) {
			console.error(`Error fetching ${type} list:`, err);
			return [];
		}
	}

	async fetchResource(type: string, namespace: string, name: string): Promise<FluxResource | null> {
		try {
			const res = await fetch(`/api/flux/${type}/${namespace}/${name}`);
			if (!res.ok) throw new Error(`Failed to fetch ${type}/${namespace}/${name}`);
			const resource = await res.json();
			this.setResource(type, namespace, name, resource);
			return resource;
		} catch (err) {
			console.error(`Error fetching resource ${type}/${namespace}/${name}:`, err);
			return null;
		}
	}
}

export const resourceCache = new ResourceCacheStore();
