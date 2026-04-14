import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import * as actualClient from '../lib/server/kubernetes/client.js';
import * as actualK8sConfig from '../lib/server/kubernetes/config.js';
import * as actualK8sErrors from '../lib/server/kubernetes/errors.js';
import * as actualResources from '../lib/server/kubernetes/flux/resources.js';
import * as actualLogger from '../lib/server/logger.js';

let validateKubeConfigResult = true;
let listDeploymentsImpl = async () => ({
	items: [
		{ metadata: { labels: { 'app.kubernetes.io/version': 'v2.3.0' }, name: 'source-controller' } }
	]
});
let readNamespaceImpl = async () => ({
	metadata: { labels: { 'app.kubernetes.io/version': 'v2.2.0' } }
});
let listFluxResourcesImpl = async (_type: string) => ({
	items: [],
	limit: 50,
	hasMore: false,
	metadata: { resourceVersion: 'rv-1' },
	offset: 0,
	total: 0
});
let getFluxResourceImpl = async () => ({
	apiVersion: 'source.toolkit.fluxcd.io/v1',
	kind: 'GitRepository',
	metadata: { name: 'demo', namespace: 'flux-system', resourceVersion: 'rv-2' }
});
let getFluxResourceStatusImpl = async () => ({
	metadata: { name: 'demo', namespace: 'flux-system', resourceVersion: 'rv-status' },
	status: { observedGeneration: 1 }
});

beforeEach(() => {
	validateKubeConfigResult = true;
	listDeploymentsImpl = async () => ({
		items: [
			{ metadata: { labels: { 'app.kubernetes.io/version': 'v2.3.0' }, name: 'source-controller' } }
		]
	});
	readNamespaceImpl = async () => ({
		metadata: { labels: { 'app.kubernetes.io/version': 'v2.2.0' } }
	});
	listFluxResourcesImpl = async (type: string) => {
		if (type === 'GitRepository') {
			return {
				items: [
					{
						metadata: { name: 'healthy', resourceVersion: 'rv-1' },
						status: { conditions: [{ status: 'True', type: 'Ready' }] }
					},
					{
						metadata: { name: 'failed' },
						status: { conditions: [{ status: 'True', type: 'Failed' }] }
					}
				],
				limit: 50,
				hasMore: false,
				metadata: { resourceVersion: 'rv-1' },
				offset: 0,
				total: 2
			};
		}

		throw new Error('overview failure');
	};
	getFluxResourceImpl = async () => ({
		apiVersion: 'source.toolkit.fluxcd.io/v1',
		kind: 'GitRepository',
		metadata: { name: 'demo', namespace: 'flux-system', resourceVersion: 'rv-2' }
	});
	getFluxResourceStatusImpl = async () => ({
		metadata: { name: 'demo', namespace: 'flux-system', resourceVersion: 'rv-status' },
		status: { observedGeneration: 1 }
	});

	mock.module('$lib/server/kubernetes/config.js', () => ({
		validateKubeConfig: async () => validateKubeConfigResult
	}));

	mock.module('$lib/server/kubernetes/client.js', () => ({
		getFluxResource: (...args: unknown[]) => getFluxResourceImpl(...args),
		getFluxResourceStatus: (...args: unknown[]) => getFluxResourceStatusImpl(...args),
		getKubeConfig: async () => ({
			getContexts: () => [{ name: 'cluster-a' }, { name: 'cluster-b' }],
			getCurrentContext: () => 'cluster-a',
			makeApiClient: (clientType: { name?: string }) => {
				if (clientType.name?.includes('AppsV1Api')) {
					return {
						listNamespacedDeployment: (...args: unknown[]) => listDeploymentsImpl(...args)
					};
				}

				return {
					readNamespace: (...args: unknown[]) => readNamespaceImpl(...args)
				};
			}
		}),
		getPoolMetrics: () => ({
			evictions: 1,
			hits: 2,
			misses: 3,
			poolSizes: { appsV1: 1, coreV1: 1, customObjects: 1 }
		}),
		listFluxResources: (...args: unknown[]) => listFluxResourcesImpl(...args)
	}));

	mock.module('$lib/server/kubernetes/errors.js', () => ({
		handleApiError: (err: unknown) => {
			throw err;
		}
	}));

	mock.module('$lib/server/kubernetes/flux/resources.js', () => ({
		getAllResourcePlurals: () => ['gitrepositories'],
		getAllResourceTypes: () => ['GitRepository', 'Kustomization'],
		resolveFluxResourceType: (resourceType: string) =>
			resourceType === 'gitrepositories' || resourceType === 'GitRepository'
				? 'GitRepository'
				: undefined
	}));

	mock.module('$lib/server/logger.js', () => ({
		logger: {
			error: () => {},
			warn: () => {}
		}
	}));
});

afterEach(() => {
	mock.restore();
	mock.module('$lib/server/kubernetes/config.js', () => actualK8sConfig);
	mock.module('$lib/server/kubernetes/client.js', () => actualClient);
	mock.module('$lib/server/kubernetes/errors.js', () => actualK8sErrors);
	mock.module('$lib/server/kubernetes/flux/resources.js', () => actualResources);
	mock.module('$lib/server/logger.js', () => actualLogger);
});

describe('flux shared services', () => {
	test('returns basic health for unauthenticated callers when details are not requested', async () => {
		const { getFluxHealthSummary } = await import(
			`../lib/server/flux/services.js?case=${Date.now()}-${Math.random()}`
		);

		await expect(
			getFluxHealthSummary({
				locals: { cluster: 'cluster-a', requestId: 'req-1', session: null, user: null },
				includeDetails: false
			})
		).resolves.toEqual({ status: 'healthy' });
	});

	test('returns detailed health metadata when requested', async () => {
		const { getFluxHealthSummary } = await import(
			`../lib/server/flux/services.js?case=${Date.now()}-${Math.random()}`
		);

		const result = await getFluxHealthSummary({
			locals: { cluster: 'cluster-a', requestId: 'req-1', session: null, user: null },
			includeDetails: true
		});

		expect(result).toEqual({
			status: 'healthy',
			kubernetes: {
				connected: true,
				configStrategy: 'local-kubeconfig',
				configSource: 'kubeconfig',
				currentContext: 'cluster-a',
				availableContexts: ['cluster-a', 'cluster-b'],
				connectionPool: {
					evictions: 1,
					hits: 2,
					misses: 3,
					poolSizes: { appsV1: 1, coreV1: 1, customObjects: 1 }
				}
			}
		});
	});

	test('falls back to the default Flux version when Flux namespace/deployments are missing', async () => {
		listDeploymentsImpl = async () => {
			throw Object.assign(new Error('not found'), { code: 404 });
		};
		const { getFluxInstalledVersion, DEFAULT_FLUX_VERSION } = await import(
			`../lib/server/flux/services.js?case=${Date.now()}-${Math.random()}`
		);

		await expect(
			getFluxInstalledVersion({
				locals: { cluster: 'cluster-a', requestId: 'req-1', session: null, user: null }
			})
		).resolves.toEqual({ version: DEFAULT_FLUX_VERSION });
	});

	test('surfaces non-benign Flux version lookup failures', async () => {
		listDeploymentsImpl = async () => {
			throw new Error('boom');
		};
		const { getFluxInstalledVersion } = await import(
			`../lib/server/flux/services.js?case=${Date.now()}-${Math.random()}`
		);

		await expect(
			getFluxInstalledVersion({
				locals: { cluster: 'cluster-a', requestId: 'req-1', session: null, user: null }
			})
		).rejects.toThrow('boom');
	});

	test('reports partial overview failures while keeping successful summaries', async () => {
		const { getFluxOverviewSummary } = await import(
			`../lib/server/flux/services.js?case=${Date.now()}-${Math.random()}`
		);

		const result = await getFluxOverviewSummary({
			locals: { cluster: 'cluster-a', requestId: 'req-1', session: null, user: null }
		});

		expect(result.partialFailure).toBe(true);
		expect(result.results).toEqual([
			{
				type: 'GitRepository',
				total: 2,
				healthy: 1,
				failed: 1,
				suspended: 0
			}
		]);
	});

	test('lists resources with resourceVersion metadata for etag passthrough', async () => {
		listFluxResourcesImpl = async () => ({
			items: [{ metadata: { name: 'demo' } }],
			limit: 50,
			hasMore: false,
			metadata: { resourceVersion: 'rv-list' },
			offset: 0,
			total: 1
		});
		const { listFluxResourcesForType } = await import(
			`../lib/server/flux/services.js?case=${Date.now()}-${Math.random()}`
		);

		const result = await listFluxResourcesForType({
			locals: { cluster: 'cluster-a', requestId: 'req-1', session: null, user: null },
			query: { limit: 25 },
			resourceType: 'gitrepositories'
		});

		expect(result).toEqual({
			resourceType: 'GitRepository',
			result: {
				items: [{ metadata: { name: 'demo' } }],
				limit: 50,
				hasMore: false,
				metadata: { resourceVersion: 'rv-list' },
				offset: 0,
				total: 1
			}
		});
	});

	test('returns detail data for status-only lookups and preserves resourceVersion', async () => {
		const { getFluxResourceDetail } = await import(
			`../lib/server/flux/services.js?case=${Date.now()}-${Math.random()}`
		);

		const result = await getFluxResourceDetail({
			locals: { cluster: 'cluster-a', requestId: 'req-1', session: null, user: null },
			name: 'demo',
			namespace: 'flux-system',
			resourceType: 'gitrepositories',
			statusOnly: true
		});

		expect(result).toEqual({
			resourceType: 'GitRepository',
			resource: {
				metadata: { name: 'demo', namespace: 'flux-system', resourceVersion: 'rv-status' },
				status: { observedGeneration: 1 }
			}
		});
	});

	test('surfaces resource-not-found errors from detail lookups', async () => {
		getFluxResourceImpl = async () => {
			throw {
				status: 404,
				body: { message: 'GitRepository not found: flux-system/demo' }
			};
		};
		const { getFluxResourceDetail } = await import(
			`../lib/server/flux/services.js?case=${Date.now()}-${Math.random()}`
		);

		await expect(
			getFluxResourceDetail({
				locals: { cluster: 'cluster-a', requestId: 'req-1', session: null, user: null },
				name: 'demo',
				namespace: 'flux-system',
				resourceType: 'gitrepositories',
				statusOnly: false
			})
		).rejects.toEqual({
			status: 404,
			body: { message: 'GitRepository not found: flux-system/demo' }
		});
	});
});
