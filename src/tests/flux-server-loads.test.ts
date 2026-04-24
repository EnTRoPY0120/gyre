import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { IN_CLUSTER_ID } from '../lib/clusters/identity.js';
import * as actualAdminReadiness from '../lib/server/admin-readiness.js';
import * as actualDashboardCache from '../lib/server/dashboard-cache.js';
import * as actualClusters from '../lib/server/clusters.js';
import * as actualServices from '../lib/server/flux/services.js';
import * as actualGuards from '../lib/server/http/guards.js';
import * as actualMetrics from '../lib/server/metrics.js';

let healthResult: unknown = {
	status: 'healthy',
	kubernetes: {
		connected: true,
		currentContext: 'dev-context',
		availableContexts: ['dev-context']
	}
};
let healthShouldThrow = false;
let versionResult = { version: 'v2.3.0' };
let overviewResult = {
	partialFailure: true,
	results: [{ type: 'GitRepository', total: 3, healthy: 2, failed: 1, suspended: 0 }]
};
let listResult = {
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
let detailResult = {
	resourceType: 'GitRepository',
	resource: { metadata: { name: 'demo', namespace: 'flux-system' } }
};
let detailServiceError: unknown = null;
let clusterReadShouldThrow = false;
const getDashboardCacheCalls: string[] = [];
const getDashboardCacheKeyCalls: Array<{ clusterId: string; role: string; userId: string }> = [];
const dashboardCacheEntries = new Map<string, unknown>();
let selectableClusters = [
	{
		id: IN_CLUSTER_ID,
		name: 'In-cluster',
		description: 'Runtime Kubernetes configuration',
		source: 'in-cluster' as const,
		isActive: true,
		currentContext: 'dev-context'
	},
	{
		id: 'cluster-a',
		name: 'Uploaded Cluster A',
		description: 'Uploaded kubeconfig',
		source: 'uploaded' as const,
		isActive: true,
		currentContext: null
	}
] as const;
const setDashboardCacheCalls: Array<{ key: string; value: unknown }> = [];
const requireClusterWideReadCalls: string[] = [];
const adminReadinessCalls: boolean[] = [];
const overviewCalls: Array<{ clusterId: string; role?: string; userId?: string }> = [];
let adminReadinessResult = {
	status: 'ready' as const,
	readyCount: 4,
	attentionCount: 0,
	actionRequiredCount: 0,
	steps: []
};

function getExpectedSelectableClustersContext() {
	if (healthShouldThrow) {
		return null;
	}

	const kubernetes = (healthResult as { kubernetes?: { currentContext?: string | null } })
		.kubernetes;
	return kubernetes?.currentContext ?? null;
}

function requireClusterContextMock(locals: App.Locals) {
	if (!locals.cluster) {
		throw { status: 400, body: { message: 'Cluster context required' } };
	}

	return locals.cluster;
}

function createUser() {
	return {
		id: 'user-1',
		username: 'alice',
		role: 'admin',
		email: null,
		isLocal: true,
		preferences: null
	};
}

beforeEach(() => {
	healthResult = {
		status: 'healthy',
		kubernetes: {
			connected: true,
			currentContext: 'dev-context',
			availableContexts: ['dev-context']
		}
	};
	healthShouldThrow = false;
	versionResult = { version: 'v2.3.0' };
	overviewResult = {
		partialFailure: true,
		results: [{ type: 'GitRepository', total: 3, healthy: 2, failed: 1, suspended: 0 }]
	};
	listResult = {
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
	detailResult = {
		resourceType: 'GitRepository',
		resource: { metadata: { name: 'demo', namespace: 'flux-system' } }
	};
	detailServiceError = null;
	clusterReadShouldThrow = false;
	getDashboardCacheCalls.length = 0;
	getDashboardCacheKeyCalls.length = 0;
	requireClusterWideReadCalls.length = 0;
	setDashboardCacheCalls.length = 0;
	adminReadinessCalls.length = 0;
	overviewCalls.length = 0;
	dashboardCacheEntries.clear();
	adminReadinessResult = {
		status: 'ready',
		readyCount: 4,
		attentionCount: 0,
		actionRequiredCount: 0,
		steps: []
	};
	selectableClusters = [
		{
			id: IN_CLUSTER_ID,
			name: 'In-cluster',
			description: 'Runtime Kubernetes configuration',
			source: 'in-cluster' as const,
			isActive: true,
			currentContext: 'dev-context'
		},
		{
			id: 'cluster-a',
			name: 'Uploaded Cluster A',
			description: 'Uploaded kubeconfig',
			source: 'uploaded' as const,
			isActive: true,
			currentContext: null
		}
	] as const;

	mock.module('$lib/server/flux/services.js', () => ({
		DEFAULT_FLUX_VERSION: 'v2.x.x',
		getFluxHealthSummary: async () => {
			if (healthShouldThrow) {
				throw { status: 503, body: { message: 'Unable to connect to Kubernetes cluster' } };
			}
			return healthResult;
		},
		getFluxInstalledVersion: async () => versionResult,
		getFluxOverviewSummary: async ({ locals }: { locals: App.Locals }) => {
			overviewCalls.push({
				clusterId: locals.cluster ?? IN_CLUSTER_ID,
				role: locals.user?.role,
				userId: locals.user?.id
			});
			return overviewResult;
		},
		getFluxResourceDetail: async () => {
			if (detailServiceError) {
				throw detailServiceError;
			}
			return detailResult;
		},
		listFluxResourcesForType: async () => listResult
	}));

	mock.module('$lib/server/http/guards.js', () => ({
		requireClusterContext: (locals: App.Locals) => requireClusterContextMock(locals),
		requireClusterWideRead: async (locals: App.Locals) => {
			const clusterId = requireClusterContextMock(locals);
			if (!locals.user) {
				throw { status: 403, body: { message: 'Permission denied' } };
			}
			requireClusterWideReadCalls.push(clusterId);
			if (clusterReadShouldThrow) {
				throw { status: 403, body: { message: 'Permission denied' } };
			}
		},
		requireScopedPermission: async (locals: App.Locals) => {
			requireClusterContextMock(locals);
			if (!locals.user) {
				throw { status: 403, body: { message: 'Permission denied' } };
			}
		}
	}));

	mock.module('$lib/server/clusters.js', () => ({
		getSelectableClusters: async (currentContext?: string | null) => {
			const expectedContext = getExpectedSelectableClustersContext();
			if (currentContext !== expectedContext) {
				throw new Error(
					`Expected getSelectableClusters currentContext ${String(expectedContext)}, received ${String(currentContext)}`
				);
			}

			return selectableClusters;
		}
	}));

	mock.module('$lib/server/dashboard-cache', () => ({
		getDashboardCache: (key: string) => {
			getDashboardCacheCalls.push(key);
			return dashboardCacheEntries.get(key) ?? null;
		},
		getDashboardCacheKey: (parts: { clusterId: string; role: string; userId: string }) => {
			getDashboardCacheKeyCalls.push(parts);
			return `dashboard:user:${parts.userId}:role:${parts.role}:cluster:${parts.clusterId}`;
		},
		setDashboardCache: (key: string, value: unknown) => {
			dashboardCacheEntries.set(key, value);
			setDashboardCacheCalls.push({ key, value });
		}
	}));

	mock.module('$lib/server/metrics.js', () => ({
		...actualMetrics,
		loginAttemptsTotal: { labels: () => ({ inc: () => {} }) },
		sessionsCleanedUpTotal: { inc: () => {} }
	}));

	mock.module('$lib/server/admin-readiness.js', () => ({
		getAdminReadinessSummary: async () => {
			adminReadinessCalls.push(true);
			return adminReadinessResult;
		}
	}));
});

afterEach(() => {
	mock.restore();
	mock.module('$lib/server/flux/services.js', () => actualServices);
	mock.module('$lib/server/clusters.js', () => actualClusters);
	mock.module('$lib/server/http/guards.js', () => actualGuards);
	mock.module('$lib/server/dashboard-cache', () => actualDashboardCache);
	mock.module('$lib/server/metrics.js', () => actualMetrics);
	mock.module('$lib/server/admin-readiness.js', () => actualAdminReadiness);
});

describe('migrated server loads', () => {
	async function loadDashboardPage(locals: App.Locals, parentClusterId = 'cluster-b') {
		const { load } = await import(`../routes/+page.server.js?case=${Date.now()}-${Math.random()}`);

		return await load({
			locals,
			parent: async () => ({
				health: {
					connected: true,
					currentClusterId: parentClusterId,
					currentClusterName: parentClusterId,
					availableClusters: []
				}
			}),
			setHeaders: () => {}
		} as Parameters<typeof load>[0]);
	}

	test('layout load uses shared services and preserves health/version fallbacks', async () => {
		const { load } = await import(
			`../routes/+layout.server.js?case=${Date.now()}-${Math.random()}`
		);

		const success = await load({
			depends: () => {},
			locals: {
				cluster: 'cluster-a',
				requestId: 'req-1',
				session: null,
				user: createUser()
			}
		} as Parameters<typeof load>[0]);

		expect(success).toMatchObject({
			health: {
				connected: true,
				currentClusterId: 'cluster-a',
				currentClusterName: 'Uploaded Cluster A',
				availableClusters: [
					{
						id: IN_CLUSTER_ID,
						name: 'In-cluster'
					},
					{
						id: 'cluster-a',
						name: 'Uploaded Cluster A',
						connected: true
					}
				],
				error: undefined
			},
			fluxVersion: 'v2.3.0'
		});

		healthShouldThrow = true;
		clusterReadShouldThrow = true;

		const fallback = await load({
			depends: () => {},
			locals: {
				cluster: 'cluster-a',
				requestId: 'req-1',
				session: null,
				user: createUser()
			}
		} as Parameters<typeof load>[0]);

		expect(fallback).toMatchObject({
			health: {
				connected: false,
				currentClusterId: 'cluster-a',
				currentClusterName: 'Uploaded Cluster A',
				availableClusters: [
					{
						id: IN_CLUSTER_ID,
						name: 'In-cluster'
					},
					{
						id: 'cluster-a',
						name: 'Uploaded Cluster A'
					}
				],
				error: 'Failed to retrieve cluster health status'
			},
			fluxVersion: 'v2.x.x'
		});
	});

	test('dashboard load uses overview service and preserves grouped counts plus cache writes', async () => {
		const result = await loadDashboardPage({
			cluster: 'cluster-a',
			requestId: 'req-1',
			session: null,
			user: createUser()
		} as App.Locals);

		const groupCounts = await result.streamed.groupCounts;
		expect(result.adminReadiness).toEqual(adminReadinessResult);
		expect(groupCounts.Sources).toEqual({
			total: 3,
			healthy: 2,
			failed: 1,
			suspended: 0,
			error: true
		});
		expect(setDashboardCacheCalls).toEqual([
			{
				key: 'dashboard:user:user-1:role:admin:cluster:cluster-a',
				value: groupCounts
			}
		]);
		expect(getDashboardCacheKeyCalls).toEqual([
			{ userId: 'user-1', role: 'admin', clusterId: 'cluster-a' }
		]);
		expect(getDashboardCacheCalls).toEqual(['dashboard:user:user-1:role:admin:cluster:cluster-a']);
		expect(requireClusterWideReadCalls).toEqual(['cluster-a']);
		expect(adminReadinessCalls).toEqual([true]);
		expect(overviewCalls).toEqual([{ clusterId: 'cluster-a', role: 'admin', userId: 'user-1' }]);
	});

	test('dashboard load does not access cache before permission checks fail', async () => {
		clusterReadShouldThrow = true;
		const result = await loadDashboardPage(
			{
				cluster: 'cluster-a',
				requestId: 'req-1',
				session: null,
				user: createUser()
			} as App.Locals,
			'cluster-a'
		);

		expect(await result.streamed.groupCounts).toEqual({});
		expect(getDashboardCacheKeyCalls).toEqual([]);
		expect(getDashboardCacheCalls).toEqual([]);
		expect(setDashboardCacheCalls).toEqual([]);
		expect(requireClusterWideReadCalls).toEqual(['cluster-a']);
		expect(adminReadinessCalls).toEqual([true]);
		expect(overviewCalls).toEqual([]);
	});

	test('dashboard load does not include admin readiness for non-admin users', async () => {
		const result = await loadDashboardPage(
			{
				cluster: 'cluster-a',
				requestId: 'req-1',
				session: null,
				user: { ...createUser(), role: 'editor' }
			} as App.Locals,
			'cluster-a'
		);

		expect(result.adminReadiness).toBeUndefined();
		expect(adminReadinessCalls).toEqual([]);
	});

	test('dashboard cache isolates entries by user id', async () => {
		const cachedGroupCounts = {
			Sources: { total: 99, healthy: 99, failed: 0, suspended: 0, error: false }
		};
		dashboardCacheEntries.set(
			'dashboard:user:user-1:role:admin:cluster:cluster-a',
			cachedGroupCounts
		);

		const cachedResult = await loadDashboardPage(
			{
				cluster: 'cluster-a',
				requestId: 'req-1',
				session: null,
				user: createUser()
			} as App.Locals,
			'cluster-a'
		);
		expect(await cachedResult.streamed.groupCounts).toBe(cachedGroupCounts);

		const freshResult = await loadDashboardPage(
			{
				cluster: 'cluster-a',
				requestId: 'req-2',
				session: null,
				user: { ...createUser(), id: 'user-2', username: 'bob' }
			} as App.Locals,
			'cluster-a'
		);
		expect(await freshResult.streamed.groupCounts).not.toBe(cachedGroupCounts);

		expect(getDashboardCacheCalls).toEqual([
			'dashboard:user:user-1:role:admin:cluster:cluster-a',
			'dashboard:user:user-2:role:admin:cluster:cluster-a'
		]);
		expect(overviewCalls).toEqual([{ clusterId: 'cluster-a', role: 'admin', userId: 'user-2' }]);
	});

	test('dashboard cache isolates entries by role', async () => {
		const cachedGroupCounts = {
			Sources: { total: 7, healthy: 7, failed: 0, suspended: 0, error: false }
		};
		dashboardCacheEntries.set(
			'dashboard:user:user-1:role:admin:cluster:cluster-a',
			cachedGroupCounts
		);

		const adminResult = await loadDashboardPage(
			{
				cluster: 'cluster-a',
				requestId: 'req-1',
				session: null,
				user: createUser()
			} as App.Locals,
			'cluster-a'
		);
		expect(await adminResult.streamed.groupCounts).toBe(cachedGroupCounts);

		const editorResult = await loadDashboardPage(
			{
				cluster: 'cluster-a',
				requestId: 'req-2',
				session: null,
				user: { ...createUser(), role: 'editor' }
			} as App.Locals,
			'cluster-a'
		);
		expect(await editorResult.streamed.groupCounts).not.toBe(cachedGroupCounts);

		expect(getDashboardCacheCalls).toEqual([
			'dashboard:user:user-1:role:admin:cluster:cluster-a',
			'dashboard:user:user-1:role:editor:cluster:cluster-a'
		]);
		expect(overviewCalls).toEqual([{ clusterId: 'cluster-a', role: 'editor', userId: 'user-1' }]);
	});

	test('dashboard cache isolates entries by locals.cluster instead of parent health cluster', async () => {
		const cachedGroupCounts = {
			Sources: { total: 5, healthy: 5, failed: 0, suspended: 0, error: false }
		};
		dashboardCacheEntries.set(
			'dashboard:user:user-1:role:admin:cluster:cluster-a',
			cachedGroupCounts
		);

		const result = await loadDashboardPage(
			{
				cluster: 'cluster-b',
				requestId: 'req-1',
				session: null,
				user: createUser()
			} as App.Locals,
			'cluster-a'
		);
		expect(await result.streamed.groupCounts).not.toBe(cachedGroupCounts);

		expect(getDashboardCacheKeyCalls).toEqual([
			{ userId: 'user-1', role: 'admin', clusterId: 'cluster-b' }
		]);
		expect(getDashboardCacheCalls).toEqual(['dashboard:user:user-1:role:admin:cluster:cluster-b']);
		expect(overviewCalls).toEqual([{ clusterId: 'cluster-b', role: 'admin', userId: 'user-1' }]);
	});

	test('resource list load calls the shared service and keeps the UI-facing shape', async () => {
		const { load } = await import(
			`../routes/resources/[type]/+page.server.js?case=${Date.now()}-${Math.random()}`
		);

		const result = await load({
			depends: () => {},
			locals: { cluster: 'cluster-a', requestId: 'req-1', session: null, user: createUser() },
			params: { type: 'gitrepositories' },
			url: new URL('http://localhost/resources/gitrepositories?sortBy=name&sortOrder=desc')
		} as Parameters<typeof load>[0]);

		expect(result).toMatchObject({
			resourceType: 'gitrepositories',
			resources: [{ metadata: { name: 'demo' } }],
			total: 1,
			sortBy: 'name',
			sortOrder: 'desc',
			error: null
		});
	});

	test('resource detail load calls the shared service and preserves 404/error semantics', async () => {
		const { load } = await import(
			`../routes/resources/[type]/[namespace]/[name]/+page.server.js?case=${Date.now()}-${Math.random()}`
		);

		const result = await load({
			depends: () => {},
			locals: { cluster: 'cluster-a', requestId: 'req-1', session: null, user: createUser() },
			params: { type: 'gitrepositories', namespace: 'flux-system', name: 'demo' }
		} as Parameters<typeof load>[0]);

		expect(result).toMatchObject({
			resourceType: 'gitrepositories',
			namespace: 'flux-system',
			name: 'demo',
			resource: { metadata: { name: 'demo', namespace: 'flux-system' } }
		});

		detailServiceError = { status: 404, body: { message: 'upstream missing' } };
		const { load: load404 } = await import(
			`../routes/resources/[type]/[namespace]/[name]/+page.server.js?case=${Date.now()}-${Math.random()}`
		);
		await expect(
			load404({
				depends: () => {},
				locals: {
					cluster: 'cluster-a',
					requestId: 'req-1',
					session: null,
					user: createUser()
				},
				params: { type: 'gitrepositories', namespace: 'flux-system', name: 'demo' }
			} as Parameters<typeof load404>[0])
		).rejects.toMatchObject({
			status: 404,
			body: { message: 'Resource not found: flux-system/demo' }
		});

		detailServiceError = { status: 500, body: { message: 'service exploded' } };
		const { load: load500 } = await import(
			`../routes/resources/[type]/[namespace]/[name]/+page.server.js?case=${Date.now()}-${Math.random()}`
		);
		await expect(
			load500({
				depends: () => {},
				locals: {
					cluster: 'cluster-a',
					requestId: 'req-1',
					session: null,
					user: createUser()
				},
				params: { type: 'gitrepositories', namespace: 'flux-system', name: 'demo' }
			} as Parameters<typeof load500>[0])
		).rejects.toMatchObject({
			status: 500,
			body: { message: 'service exploded' }
		});
	});
});
