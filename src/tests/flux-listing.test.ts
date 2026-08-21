import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const listClusterCustomObject = vi.fn();
const listNamespacedCustomObject = vi.fn();

beforeEach(() => {
	vi.resetModules();
	listClusterCustomObject.mockReset();
	listNamespacedCustomObject.mockReset();

	vi.doMock('$lib/server/kubernetes/client-pool.js', () => ({
		getCustomObjectsApi: async () => ({ listClusterCustomObject, listNamespacedCustomObject })
	}));
	vi.doMock('$lib/server/kubernetes/error-handler.js', () => ({
		handleK8sError: (error: unknown) => error
	}));
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.resetModules();
});

describe('listFluxResources', () => {
	test('delegates the first unsorted page to Kubernetes native paging', async () => {
		listClusterCustomObject.mockResolvedValue({
			items: [{ metadata: { name: 'one' } }],
			metadata: { resourceVersion: 'rv-1', continue: 'next-page' }
		});
		const { listFluxResources } = await import('$lib/server/kubernetes/flux/listing.js');

		const result = await listFluxResources('GitRepository', 'cluster-a', undefined, { limit: 1 });

		expect(listClusterCustomObject).toHaveBeenCalledWith({
			group: 'source.toolkit.fluxcd.io',
			version: 'v1',
			plural: 'gitrepositories',
			limit: 1
		});
		expect(result).toEqual({
			items: [{ metadata: { name: 'one' } }],
			total: null,
			hasMore: true,
			offset: 0,
			limit: 1,
			metadata: { resourceVersion: 'rv-1', continueToken: 'next-page' }
		});
	});

	test('sorts by status and applies deterministic tie-breakers before pagination', async () => {
		listClusterCustomObject.mockResolvedValue({
			items: [
				{
					metadata: { name: 'healthy-b', uid: '2' },
					status: { conditions: [{ type: 'Ready', status: 'True' }] }
				},
				{
					metadata: { name: 'failed', uid: '3' },
					status: { conditions: [{ type: 'Ready', status: 'False' }] }
				},
				{
					metadata: { name: 'healthy-a', uid: '1' },
					status: { conditions: [{ type: 'Ready', status: 'True' }] }
				}
			]
		});
		const { listFluxResources } = await import('$lib/server/kubernetes/flux/listing.js');

		const result = await listFluxResources('GitRepository', undefined, undefined, {
			sortBy: 'status',
			sortOrder: 'asc',
			limit: 2,
			offset: 0
		});

		expect(result.items.map((item) => item.metadata.name)).toEqual(['failed', 'healthy-a']);
		expect(result.total).toBe(3);
		expect(result.hasMore).toBe(true);
	});

	test('uses the full-fetch path for non-zero offsets and preserves descending order', async () => {
		listClusterCustomObject.mockResolvedValue({
			items: [{ metadata: { name: 'a' } }, { metadata: { name: 'c' } }, { metadata: { name: 'b' } }]
		});
		const { listFluxResources } = await import('$lib/server/kubernetes/flux/listing.js');

		const result = await listFluxResources('GitRepository', undefined, undefined, {
			sortBy: 'name',
			sortOrder: 'desc',
			limit: 1,
			offset: 1
		});

		expect(listClusterCustomObject).toHaveBeenCalledWith({
			group: 'source.toolkit.fluxcd.io',
			version: 'v1',
			plural: 'gitrepositories'
		});
		expect(result.items.map((item) => item.metadata.name)).toEqual(['b']);
		expect(result.total).toBe(3);
		expect(result.offset).toBe(1);
	});
});
