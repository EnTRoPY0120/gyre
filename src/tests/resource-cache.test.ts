import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { importFresh } from './helpers/import-fresh';
import type { FluxResource } from '../lib/types/flux.js';

type ResourceCacheModule = typeof import('../lib/stores/resourceCache.svelte.js');

let fetchListImpl: (...args: unknown[]) => Promise<FluxResource[]>;
let fetchResourceImpl: (...args: unknown[]) => Promise<FluxResource | null>;
let eventHandler: ((event: unknown) => void) | undefined;
let resourceCache: ResourceCacheModule['resourceCache'];
let previousWindow: typeof globalThis.window | undefined;

const resource = (name: string, namespace = 'team-a') =>
	({ metadata: { name, namespace } }) as FluxResource;

beforeEach(async () => {
	vi.resetModules();
	fetchListImpl = vi.fn().mockResolvedValue([]);
	fetchResourceImpl = vi.fn().mockResolvedValue(null);
	eventHandler = undefined;
	previousWindow = globalThis.window;
	Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });

	vi.doMock('../lib/stores/resource-cache-requests.js', () => ({
		fetchResourceList: (...args: unknown[]) => fetchListImpl(...args),
		fetchResourceDetail: (...args: unknown[]) => fetchResourceImpl(...args)
	}));
	vi.doMock('../lib/stores/events.svelte.js', () => ({
		eventsStore: {
			onEvent: (handler: (event: unknown) => void) => {
				eventHandler = handler;
				return () => {};
			}
		}
	}));
	vi.doMock('../lib/stores/cluster.svelte.js', () => ({ clusterStore: { current: 'cluster-a' } }));
	vi.doMock('$lib/utils/logger.js', () => ({ logger: { error: vi.fn() } }));

	resourceCache = (await importFresh<ResourceCacheModule>('../lib/stores/resourceCache.svelte.js'))
		.resourceCache;
	resourceCache.clear();
});

afterEach(() => {
	if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
	else Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow });
	vi.restoreAllMocks();
	vi.resetModules();
});

describe('resource cache', () => {
	test('stores lists and their namespaced resources independently', () => {
		const item = resource('demo');

		resourceCache.setList('GitRepository', [item], 'team-a');

		expect(resourceCache.getList('GitRepository', 'team-a')).toEqual([item]);
		expect(resourceCache.getResource('GitRepository', 'team-a', 'demo')).toBe(item);

		resourceCache.invalidateResource('GitRepository', 'team-a', 'demo');
		resourceCache.invalidateList('GitRepository', 'team-a');

		expect(resourceCache.getResource('GitRepository', 'team-a', 'demo')).toBeNull();
		expect(resourceCache.getList('GitRepository', 'team-a')).toBeNull();
	});

	test('fetches and caches lists, falling back to stale data on failure', async () => {
		const item = resource('demo');
		fetchListImpl = vi.fn().mockResolvedValue([item]);

		await expect(resourceCache.fetchList('GitRepository', 'team a')).resolves.toEqual([item]);
		expect(fetchListImpl).toHaveBeenCalledWith(
			'/api/v1/flux/gitrepositories?namespace=team%20a',
			'gitrepositories'
		);

		resourceCache.setList('GitRepository', [item], 'team-a');
		fetchListImpl = vi.fn().mockRejectedValue(new Error('temporary failure'));

		await expect(resourceCache.fetchList('GitRepository', 'team-a')).resolves.toEqual([item]);
	});

	test('fetches resources, invalidates missing resources, and falls back to stale data', async () => {
		const item = resource('demo');
		fetchResourceImpl = vi.fn().mockResolvedValue(item);

		await expect(resourceCache.fetchResource('GitRepository', 'team-a', 'demo')).resolves.toBe(
			item
		);
		expect(fetchResourceImpl).toHaveBeenCalledWith(
			'/api/v1/flux/gitrepositories/team-a/demo',
			'gitrepositories',
			'team-a/demo'
		);

		fetchResourceImpl = vi.fn().mockResolvedValue(null);
		await expect(
			resourceCache.fetchResource('GitRepository', 'team-a', 'demo')
		).resolves.toBeNull();
		expect(resourceCache.getResource('GitRepository', 'team-a', 'demo')).toBeNull();

		resourceCache.setResource('GitRepository', 'team-a', 'demo', item);
		fetchResourceImpl = vi.fn().mockRejectedValue(new Error('temporary failure'));
		await expect(resourceCache.fetchResource('GitRepository', 'team-a', 'demo')).resolves.toBe(
			item
		);
	});

	test('invalidates the affected resource and lists when an event arrives', () => {
		const item = resource('demo');
		resourceCache.setResource('GitRepository', 'team-a', 'demo', item);
		resourceCache.setList('GitRepository', [item], 'team-a');

		eventHandler?.({
			clusterId: 'cluster-a',
			resourceType: 'GitRepository',
			resource: { metadata: { name: 'demo', namespace: 'team-a' } }
		});

		expect(resourceCache.getResource('GitRepository', 'team-a', 'demo')).toBeNull();
		expect(resourceCache.getList('GitRepository', 'team-a')).toBeNull();
	});
});
