import { flushSync } from 'svelte';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { FluxResource } from '../lib/types/flux.js';
import { runCacheEffect } from './helpers/resource-cache-write-effect.svelte.js';

vi.mock('../lib/stores/events.svelte.js', () => ({
	eventsStore: { onEvent: () => () => {} }
}));
vi.mock('../lib/stores/cluster.svelte.js', () => ({ clusterStore: { current: 'cluster-a' } }));
vi.mock('../lib/stores/resource-cache-requests.js', () => ({
	fetchResourceList: async () => [],
	fetchResourceDetail: async () => null
}));
vi.mock('#lib/utils/logger.js', () => ({ logger: { error: () => {} } }));

import { resourceCache } from '../lib/stores/resourceCache.svelte.js';

beforeEach(() => {
	resourceCache.clear();
});

afterEach(() => {
	resourceCache.clear();
});

const resource = {
	metadata: { name: 'preview-fixture', namespace: 'team-a' }
} as FluxResource;

const cacheWriters: [string, () => void][] = [
	[
		'setResource',
		() => resourceCache.setResource('GitRepository', 'team-a', 'preview-fixture', resource)
	],
	['setList', () => resourceCache.setList('GitRepository', [resource], 'team-a')]
];

test.each(cacheWriters)(
	'imperative resource cache %s writes do not subscribe the caller effect to cache iteration',
	(_name, write) => {
		let runs = 0;
		const stop = runCacheEffect(() => {
			runs += 1;
			write();
		});

		try {
			flushSync();
			expect(runs).toBe(1);
			expect(resourceCache.getResource('GitRepository', 'team-a', 'preview-fixture')).toEqual(
				resource
			);
		} finally {
			stop();
		}
	}
);

test('getResource remains reactive when an imperative write updates its cache entry', () => {
	let observed: FluxResource | null = null;
	let runs = 0;
	const stop = runCacheEffect(() => {
		runs += 1;
		observed = resourceCache.getResource('GitRepository', 'team-a', 'preview-fixture');
	});

	try {
		flushSync();
		expect(runs).toBe(1);
		expect(observed).toBeNull();

		const updatedResource = {
			metadata: { name: 'preview-fixture', namespace: 'team-a' },
			status: { observedGeneration: 2 }
		} as FluxResource;
		resourceCache.setResource('GitRepository', 'team-a', 'preview-fixture', updatedResource);
		flushSync();

		expect(runs).toBe(2);
		expect(observed).toEqual(updatedResource);
	} finally {
		stop();
	}
});
