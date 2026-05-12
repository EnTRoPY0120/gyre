import { afterEach, beforeEach, describe, expect, vi, test } from 'vitest';
import { IN_CLUSTER_ID } from '../lib/clusters/identity.js';
import { importFresh } from './helpers/import-fresh';

let clusterRecord: {
	id: string;
	name: string;
	description: string | null;
	isActive: boolean;
} | null;
let localContextNames: string[] = [];
let defaultLocalContext: string | null = null;

function createCookies() {
	const values = new Map<string, string>();
	return {
		deleted: [] as Array<{ name: string; options: Record<string, unknown> }>,
		setCalls: [] as Array<{ name: string; value: string; options: Record<string, unknown> }>,
		get(name: string) {
			return values.get(name);
		},
		set(name: string, value: string, options: Record<string, unknown>) {
			values.set(name, value);
			this.setCalls.push({ name, value, options });
		},
		delete(name: string, options: Record<string, unknown>) {
			values.delete(name);
			this.deleted.push({ name, options });
		}
	};
}

async function importRoute() {
	return importFresh<typeof import('../routes/api/v1/user/cluster/+server')>(
		'../routes/api/v1/user/cluster/+server'
	);
}

beforeEach(() => {
	clusterRecord = {
		id: 'cluster-a',
		name: 'Cluster A',
		description: null,
		isActive: true
	};
	localContextNames = [];
	defaultLocalContext = null;
	vi.doMock('$lib/server/clusters/repository.js', () => ({
		getClusterById: async () => clusterRecord,
		getSelectableClusters: async () => [
			...(localContextNames.length > 0
				? localContextNames.map((name) => ({
						id: name,
						name,
						description: 'Local kubeconfig context',
						source: 'local-kubeconfig' as const,
						isActive: true,
						currentContext: name === defaultLocalContext ? name : null
					}))
				: [
						{
							id: IN_CLUSTER_ID,
							name: 'In-cluster',
							description: 'Runtime Kubernetes configuration',
							source: 'in-cluster' as const,
							isActive: true,
							currentContext: null
						}
					]),
			...(clusterRecord
				? [
						{
							id: clusterRecord.id,
							name: clusterRecord.name,
							description: clusterRecord.description,
							source: 'uploaded' as const,
							isActive: clusterRecord.isActive,
							currentContext: null
						}
					]
				: [])
		]
	}));
	vi.doMock('$lib/server/clusters/local-kubeconfig.js', () => ({
		getDefaultLocalKubeconfigContext: () => defaultLocalContext,
		hasLocalKubeconfigContext: (contextName: string) => localContextNames.includes(contextName),
		shouldUseLocalKubeconfigContexts: () => localContextNames.length > 0
	}));
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.resetModules();
});

describe('cluster selection route', () => {
	test('PUT accepts in-cluster', async () => {
		const cookies = createCookies();
		const { PUT } = await importRoute();

		const response = await PUT({
			cookies,
			locals: { user: { id: 'user-1' } },
			request: new Request('http://localhost/api/v1/user/cluster', {
				method: 'PUT',
				body: JSON.stringify({ clusterId: IN_CLUSTER_ID })
			})
		} as never);

		expect(response.status).toBe(200);
		expect(cookies.setCalls[0]).toMatchObject({ name: 'gyre_cluster', value: IN_CLUSTER_ID });
		expect(await response.json()).toMatchObject({ currentClusterId: IN_CLUSTER_ID });
	});

	test('PUT accepts active uploaded cluster ID', async () => {
		const cookies = createCookies();
		const { PUT } = await importRoute();

		const response = await PUT({
			cookies,
			locals: { user: { id: 'user-1' } },
			request: new Request('http://localhost/api/v1/user/cluster', {
				method: 'PUT',
				body: JSON.stringify({ clusterId: 'cluster-a' })
			})
		} as never);

		expect(response.status).toBe(200);
		expect(cookies.setCalls[0]).toMatchObject({ name: 'gyre_cluster', value: 'cluster-a' });
		expect(await response.json()).toMatchObject({ currentClusterId: 'cluster-a' });
	});

	test('PUT accepts local kubeconfig context names', async () => {
		localContextNames = ['kind-kind', 'prod'];
		defaultLocalContext = 'kind-kind';
		const cookies = createCookies();
		const { PUT } = await importRoute();

		const response = await PUT({
			cookies,
			locals: { user: { id: 'user-1' } },
			request: new Request('http://localhost/api/v1/user/cluster', {
				method: 'PUT',
				body: JSON.stringify({ clusterId: 'prod' })
			})
		} as never);

		expect(response.status).toBe(200);
		expect(cookies.setCalls[0]).toMatchObject({ name: 'gyre_cluster', value: 'prod' });
		expect(await response.json()).toMatchObject({ currentClusterId: 'prod' });
	});

	test('PUT maps in-cluster to the default local kubeconfig context in local mode', async () => {
		localContextNames = ['kind-kind', 'prod'];
		defaultLocalContext = 'kind-kind';
		const cookies = createCookies();
		const { PUT } = await importRoute();

		const response = await PUT({
			cookies,
			locals: { user: { id: 'user-1' } },
			request: new Request('http://localhost/api/v1/user/cluster', {
				method: 'PUT',
				body: JSON.stringify({ clusterId: IN_CLUSTER_ID })
			})
		} as never);

		expect(response.status).toBe(200);
		expect(cookies.setCalls[0]).toMatchObject({ name: 'gyre_cluster', value: 'kind-kind' });
		expect(await response.json()).toMatchObject({ currentClusterId: 'kind-kind' });
	});

	test('PUT rejects inactive or missing cluster', async () => {
		clusterRecord = { id: 'cluster-a', name: 'Cluster A', description: null, isActive: false };
		const { PUT } = await importRoute();

		await expect(
			PUT({
				cookies: createCookies(),
				locals: { user: { id: 'user-1' } },
				request: new Request('http://localhost/api/v1/user/cluster', {
					method: 'PUT',
					body: JSON.stringify({ clusterId: 'cluster-a' })
				})
			} as never)
		).rejects.toMatchObject({ status: 404 });
	});

	test('DELETE clears selection', async () => {
		const cookies = createCookies();
		const { DELETE } = await importRoute();

		const response = await DELETE({
			cookies,
			locals: { user: { id: 'user-1' } }
		} as never);

		expect(response.status).toBe(200);
		expect(cookies.deleted).toContainEqual({ name: 'gyre_cluster', options: { path: '/' } });
		expect(await response.json()).toMatchObject({ currentClusterId: IN_CLUSTER_ID });
	});
});
