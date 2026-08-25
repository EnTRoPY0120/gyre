import { describe, expect, test, vi } from 'vitest';
import { fetchResourceDetail, fetchResourceList } from '../lib/stores/resource-cache-requests.js';

const resource = {
	apiVersion: 'source.toolkit.fluxcd.io/v1',
	kind: 'GitRepository',
	metadata: { name: 'app', namespace: 'flux-system' }
};

describe('fetchResourceList', () => {
	test('returns list items from a successful response', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify({ items: [resource] }), { status: 200 }));

		await expect(fetchResourceList('/api/resources', 'GitRepository', fetcher)).resolves.toEqual([
			resource
		]);
		expect(fetcher).toHaveBeenCalledWith('/api/resources');
	});

	test('treats client failures as an empty list and server failures as errors', async () => {
		await expect(
			fetchResourceList(
				'/api/resources',
				'GitRepository',
				vi.fn().mockResolvedValue(new Response(null, { status: 404 }))
			)
		).resolves.toEqual([]);

		await expect(
			fetchResourceList(
				'/api/resources',
				'GitRepository',
				vi.fn().mockResolvedValue(new Response(null, { status: 503 }))
			)
		).rejects.toThrow('Failed to fetch GitRepository list: 503');
	});
});

describe('fetchResourceDetail', () => {
	test('returns a resource and preserves the resource path in errors', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify(resource), { status: 200 }));

		await expect(
			fetchResourceDetail('/api/resources/app', 'GitRepository', 'flux-system/app', fetcher)
		).resolves.toEqual(resource);

		await expect(
			fetchResourceDetail(
				'/api/resources/app',
				'GitRepository',
				'flux-system/app',
				vi.fn().mockResolvedValue(new Response(null, { status: 500 }))
			)
		).rejects.toThrow('Failed to fetch GitRepository/flux-system/app: 500');
	});

	test('returns null for client errors', async () => {
		await expect(
			fetchResourceDetail(
				'/api/resources/app',
				'GitRepository',
				'flux-system/app',
				vi.fn().mockResolvedValue(new Response(null, { status: 404 }))
			)
		).resolves.toBeNull();
	});
});
