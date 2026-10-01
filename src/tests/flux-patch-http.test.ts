import * as http from 'node:http';
import * as k8s from '@kubernetes/client-node';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { makeApiClientWithTimeout } from '../lib/server/kubernetes/client-factory.js';
import { OPERATION_TIMEOUTS } from '../lib/server/kubernetes/timeouts.js';
import { clearClientPool } from '../lib/server/kubernetes/client-pool.js';
import { importFresh } from './helpers/import-fresh';

interface CapturedRequest {
	method: string;
	url: string;
	headers: http.IncomingHttpHeaders;
	body: string;
}

let server: http.Server;
let serverUrl = '';
let requests: CapturedRequest[] = [];
let responseStatus = 200;
let selectedContexts: string[] = [];
let apisByContext: Record<string, k8s.CustomObjectsApi>;

function makeKubeConfig(server: string, token: string): k8s.KubeConfig {
	const config = new k8s.KubeConfig();
	config.loadFromOptions({
		clusters: [{ name: 'test', server, skipTLSVerify: true }],
		users: [{ name: 'test', token }],
		contexts: [{ name: 'test', user: 'test', cluster: 'test' }],
		currentContext: 'test'
	});
	return config;
}

beforeEach(async () => {
	requests = [];
	responseStatus = 200;
	selectedContexts = [];
	server = http.createServer((request, response) => {
		const chunks: Buffer[] = [];
		request.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
		request.on('end', () => {
			requests.push({
				method: request.method ?? '',
				url: request.url ?? '',
				headers: request.headers,
				body: Buffer.concat(chunks).toString('utf8')
			});
			response.writeHead(responseStatus, { 'Content-Type': 'application/json' });
			response.end(JSON.stringify({ metadata: { name: 'my-app' } }));
		});
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('HTTP server did not bind');
	serverUrl = `http://127.0.0.1:${address.port}`;
	apisByContext = {
		clusterA: await makeApiClientWithTimeout(
			makeKubeConfig(serverUrl, 'cluster-a-token'),
			k8s.CustomObjectsApi,
			OPERATION_TIMEOUTS.list
		),
		clusterB: await makeApiClientWithTimeout(
			makeKubeConfig(serverUrl, 'cluster-b-token'),
			k8s.CustomObjectsApi,
			OPERATION_TIMEOUTS.list
		)
	};
	vi.doMock('../lib/server/kubernetes/client.js', () => ({
		getCustomObjectsApi: async (context?: string) => {
			selectedContexts.push(context ?? '');
			return apisByContext[context ?? 'clusterA'];
		},
		handleK8sError: (error: unknown, context: string) =>
			new Error(`K8s error in ${context}: ${error instanceof Error ? error.message : 'Unknown'}`)
	}));
	vi.doMock('../lib/server/kubernetes/flux/resources.js', () => ({
		getResourceDef: () => ({
			group: 'kustomize.toolkit.fluxcd.io',
			version: 'v1',
			plural: 'kustomizations'
		}),
		resolveFluxResourceType: () => 'Kustomization'
	}));
	vi.doMock('../lib/server/kubernetes/flux/reconciliation-tracker.js', () => ({
		getReconciliationHistory: async () => [
			{
				id: 'history-1',
				revision: 'main@sha1:abc',
				specSnapshot: JSON.stringify({ path: './previous' })
			}
		]
	}));
});

afterEach(async () => {
	vi.resetModules();
	vi.restoreAllMocks();
	clearClientPool();
	await new Promise<void>((resolve, reject) =>
		server.close((error) => (error ? reject(error) : resolve()))
	);
});

describe('Flux patch requests through the Kubernetes SDK', () => {
	test('suspend sends a JSON Patch with its content type, auth, selected cluster, and response', async () => {
		const { toggleSuspendResource } = await importFresh<
			typeof import('../lib/server/kubernetes/flux/actions.js')
		>('../lib/server/kubernetes/flux/actions.ts');

		await toggleSuspendResource('Kustomization', 'flux-system', 'my-app', true, 'clusterB');

		expect(selectedContexts).toEqual(['clusterB']);
		expect(requests).toHaveLength(1);
		expect(requests[0]).toMatchObject({
			method: 'PATCH',
			url: '/apis/kustomize.toolkit.fluxcd.io/v1/namespaces/flux-system/kustomizations/my-app',
			headers: {
				authorization: 'Bearer cluster-b-token',
				'content-type': 'application/json-patch+json'
			}
		});
		expect(JSON.parse(requests[0].body)).toEqual([
			{ op: 'add', path: '/spec/suspend', value: true }
		]);
	});

	test('reconcile sends an atomic Merge Patch and surfaces an API failure', async () => {
		responseStatus = 422;
		const { reconcileResource } = await importFresh<
			typeof import('../lib/server/kubernetes/flux/actions.js')
		>('../lib/server/kubernetes/flux/actions.ts');

		await expect(
			reconcileResource('Kustomization', 'flux-system', 'my-app', 'clusterA')
		).rejects.toThrow('K8s error in reconcile my-app');

		expect(selectedContexts).toEqual(['clusterA']);
		expect(requests).toHaveLength(1);
		expect(requests[0].headers.authorization).toBe('Bearer cluster-a-token');
		expect(requests[0].headers['content-type']).toBe('application/merge-patch+json');
		expect(JSON.parse(requests[0].body)).toMatchObject({
			metadata: { annotations: { 'reconcile.fluxcd.io/requestedAt': expect.any(String) } }
		});
	});

	test('rollback sends its Merge Patch through the selected cluster client', async () => {
		const { rollbackResource } = await importFresh<
			typeof import('../lib/server/kubernetes/flux/history.js')
		>('../lib/server/kubernetes/flux/history.ts');

		await rollbackResource('Kustomization', 'flux-system', 'my-app', 'history-1', 'clusterB');

		expect(selectedContexts).toEqual(['clusterB']);
		expect(requests).toHaveLength(1);
		expect(requests[0].headers.authorization).toBe('Bearer cluster-b-token');
		expect(requests[0].headers['content-type']).toBe('application/merge-patch+json');
		expect(JSON.parse(requests[0].body)).toMatchObject({
			spec: { path: './previous' },
			metadata: { annotations: { 'gyre.io/rolledBackFrom': 'main@sha1:abc' } }
		});
	});
});
