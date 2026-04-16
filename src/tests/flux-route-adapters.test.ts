import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { importFresh } from './helpers/import-fresh';

let listServiceResult = {
	resourceType: 'GitRepository',
	result: {
		items: [{ metadata: { name: 'demo' } }],
		total: 1,
		hasMore: false,
		offset: 0,
		limit: 50,
		metadata: { resourceVersion: 'rv-list' }
	}
};
let detailServiceResult = {
	resourceType: 'GitRepository',
	resource: {
		metadata: { name: 'demo', namespace: 'flux-system', resourceVersion: 'rv-detail' }
	}
};

const guardCalls: string[] = [];
const serviceCalls: Array<{ name: string; payload: unknown }> = [];
beforeEach(() => {
	guardCalls.length = 0;
	serviceCalls.length = 0;
	listServiceResult = {
		resourceType: 'GitRepository',
		result: {
			items: [{ metadata: { name: 'demo' } }],
			total: 1,
			hasMore: false,
			offset: 0,
			limit: 50,
			metadata: { resourceVersion: 'rv-list' }
		}
	};
	detailServiceResult = {
		resourceType: 'GitRepository',
		resource: {
			metadata: { name: 'demo', namespace: 'flux-system', resourceVersion: 'rv-detail' }
		}
	};

	mock.module('$lib/server/http/guards.js', () => ({
		requireAuthenticatedUser: () => {
			guardCalls.push('requireAuthenticatedUser');
		},
		requireClusterContext: () => {
			guardCalls.push('requireClusterContext');
			return 'cluster-a';
		},
		requireClusterWideRead: async () => {
			guardCalls.push('requireClusterWideRead');
		},
		requireScopedPermission: async (_locals: App.Locals, action: string) => {
			guardCalls.push(`requireScopedPermission:${action}`);
		},
		requireAdminPermission: async () => {
			guardCalls.push('requireAdminPermission');
		}
	}));

	mock.module('$lib/server/flux/services.js', () => ({
		DEFAULT_FLUX_VERSION: 'v2.x.x',
		getFluxHealthSummary: async () => ({
			status: 'healthy',
			kubernetes: { connected: true, currentContext: 'dev-context', availableContexts: [] }
		}),
		getFluxInstalledVersion: async () => ({ version: 'v2.x.x' }),
		getFluxOverviewSummary: async () => ({ partialFailure: false, results: [] }),
		getFluxResourceDetail: async (payload: unknown) => {
			serviceCalls.push({ name: 'getFluxResourceDetail', payload });
			return detailServiceResult;
		},
		listFluxResourcesForType: async (payload: unknown) => {
			serviceCalls.push({ name: 'listFluxResourcesForType', payload });
			return listServiceResult;
		}
	}));
});

afterEach(() => {
	mock.restore();
});

describe('flux route adapters', () => {
	test('list route delegates to guards and shared services while keeping etag/cache behavior', async () => {
		const { GET } = await importFresh<
			typeof import('../routes/api/v1/flux/[resourceType]/+server.js')
		>('../routes/api/v1/flux/[resourceType]/+server.js');
		const headers: Record<string, string> = {};

		const response = await GET({
			params: { resourceType: 'gitrepositories' },
			locals: { cluster: 'cluster-a', requestId: 'req-1', session: null, user: null },
			request: new Request('http://localhost/api/v1/flux/gitrepositories'),
			setHeaders: (nextHeaders) => Object.assign(headers, nextHeaders),
			url: new URL('http://localhost/api/v1/flux/gitrepositories')
		} as Parameters<typeof GET>[0]);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(listServiceResult.result);
		expect(headers).toMatchObject({
			'Cache-Control': 'private, max-age=15, stale-while-revalidate=45',
			ETag: 'W/"rv-list"'
		});
		expect(guardCalls).toEqual(
			expect.arrayContaining(['requireAuthenticatedUser', 'requireClusterWideRead'])
		);
		expect(serviceCalls).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: 'listFluxResourcesForType',
					payload: expect.objectContaining({
						resourceType: 'gitrepositories',
						locals: expect.objectContaining({
							cluster: 'cluster-a',
							requestId: 'req-1',
							session: null,
							user: null
						})
					})
				})
			])
		);
	});

	test('detail route returns 304 when If-None-Match matches the shared-service resourceVersion', async () => {
		const { GET } = await importFresh<
			typeof import('../routes/api/v1/flux/[resourceType]/[namespace]/[name]/+server.js')
		>('../routes/api/v1/flux/[resourceType]/[namespace]/[name]/+server.js');

		const response = await GET({
			params: { resourceType: 'gitrepositories', namespace: 'flux-system', name: 'demo' },
			locals: { cluster: 'cluster-a', requestId: 'req-1', session: null, user: null },
			request: new Request('http://localhost/api/v1/flux/gitrepositories/flux-system/demo', {
				headers: { 'if-none-match': 'W/"rv-detail"' }
			}),
			setHeaders: () => {},
			url: new URL('http://localhost/api/v1/flux/gitrepositories/flux-system/demo')
		} as Parameters<typeof GET>[0]);

		expect(response.status).toBe(304);
		expect(response.headers.get('ETag')).toBe('W/"rv-detail"');
		expect(guardCalls).toEqual(
			expect.arrayContaining([
				'requireAuthenticatedUser',
				'requireClusterContext',
				'requireScopedPermission:read'
			])
		);
		expect(serviceCalls).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: 'getFluxResourceDetail',
					payload: expect.objectContaining({
						resourceType: 'gitrepositories',
						locals: expect.objectContaining({
							cluster: 'cluster-a',
							requestId: 'req-1',
							session: null,
							user: null
						})
					})
				})
			])
		);
	});
});
