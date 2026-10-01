import * as dns from 'node:dns';
import http from 'node:http';
import * as k8s from '@kubernetes/client-node';
import { execFileSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { makeApiClientWithTimeout } from '../lib/server/kubernetes/client-factory.js';
import { OPERATION_TIMEOUTS } from '../lib/server/kubernetes/timeouts.js';
import { importFresh } from './helpers/import-fresh';

interface CapturedRequest {
	method: string;
	url: string;
	headers: http.IncomingHttpHeaders;
	body: string;
}

const desiredManifest = [
	'apiVersion: v1',
	'kind: ConfigMap',
	'metadata:',
	'  name: app-config',
	'  namespace: apps',
	'data:',
	'  desired: value',
	''
].join('\n');

let server: http.Server;
let fixtureDir = '';
let previousPath = '';
let previousFluxSourceControllerService: string | undefined;
let previousAgent: http.Agent;
let artifact = Buffer.alloc(0);
let requests: CapturedRequest[] = [];
let patchStatus = 200;
let selectedContexts: string[] = [];
let api: k8s.CustomObjectsApi;
let resourceDiff: typeof import('../lib/server/flux/use-cases/resource-diff.js');

function kubeConfig(url: string): k8s.KubeConfig {
	const config = new k8s.KubeConfig();
	config.loadFromOptions({
		clusters: [{ name: 'test', server: url, skipTLSVerify: true }],
		users: [{ name: 'test', token: 'diff-token' }],
		contexts: [{ name: 'test', user: 'test', cluster: 'test' }],
		currentContext: 'test'
	});
	return config;
}

beforeEach(async () => {
	requests = [];
	patchStatus = 200;
	selectedContexts = [];
	fixtureDir = await mkdtemp(join(tmpdir(), 'gyre-diff-http-test-'));
	const repositoryDir = join(fixtureDir, 'repository');
	const binDir = join(fixtureDir, 'bin');
	await mkdir(repositoryDir);
	await mkdir(binDir);
	await writeFile(join(repositoryDir, 'kustomization.yaml'), 'resources:\n  - resource.yaml\n');
	await writeFile(join(repositoryDir, 'resource.yaml'), desiredManifest);
	const tarPath = join(fixtureDir, 'artifact.tar.gz');
	execFileSync('tar', ['-czf', tarPath, '-C', repositoryDir, '.']);
	artifact = await readFile(tarPath);
	const kustomizeScript = join(binDir, 'kustomize');
	await writeFile(
		kustomizeScript,
		`#!/usr/bin/env node\nprocess.stdout.write(${JSON.stringify(desiredManifest)});\n`
	);
	await chmod(kustomizeScript, 0o755);
	previousPath = process.env.PATH ?? '';
	process.env.PATH = `${binDir}${delimiter}${previousPath}`;
	previousFluxSourceControllerService = process.env.FLUX_SOURCE_CONTROLLER_SERVICE;
	process.env.FLUX_SOURCE_CONTROLLER_SERVICE = 'source-controller';
	const serviceHost = 'source-controller.flux-system.svc';
	previousAgent = http.globalAgent;
	const localAgent = new http.Agent({
		keepAlive: false,
		lookup(hostname, options, callback) {
			if (hostname === serviceHost) {
				if (typeof options === 'function') options(null, '127.0.0.1', 4);
				else if (options.all) callback(null, [{ address: '127.0.0.1', family: 4 }]);
				else callback(null, '127.0.0.1', 4);
				return;
			}
			if (typeof options === 'function') dns.lookup(hostname, options);
			else dns.lookup(hostname, options, callback);
		}
	});
	http.globalAgent = localAgent;
	server = http.createServer((request, response) => {
		if (request.url === '/artifact.tar.gz') {
			response.writeHead(200, { 'Content-Type': 'application/gzip' });
			response.end(artifact);
			return;
		}
		const chunks: Buffer[] = [];
		request.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
		request.on('end', () => {
			requests.push({
				method: request.method ?? '',
				url: request.url ?? '',
				headers: request.headers,
				body: Buffer.concat(chunks).toString('utf8')
			});
			const status = request.method === 'PATCH' ? patchStatus : 200;
			response.writeHead(status, { 'Content-Type': 'application/json' });
			response.end(
				JSON.stringify(
					status === 200
						? {
								apiVersion: 'v1',
								kind: 'ConfigMap',
								metadata: { name: 'app-config', namespace: 'apps' },
								data: { live: 'state' }
							}
						: {
								kind: 'Status',
								status: 'Failure',
								message: 'server-side apply rejected',
								code: status
							}
				)
			);
		});
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('HTTP server did not bind');
	const serverUrl = `http://127.0.0.1:${address.port}`;
	api = await makeApiClientWithTimeout(
		kubeConfig(serverUrl),
		k8s.CustomObjectsApi,
		OPERATION_TIMEOUTS.list
	);
	const artifactUrl = `http://source-controller.flux-system.svc:${address.port}/artifact.tar.gz`;
	vi.doMock('../lib/server/kubernetes/client.js', () => ({
		getFluxResource: async (type: string) =>
			type === 'Kustomization'
				? {
						apiVersion: 'kustomize.toolkit.fluxcd.io/v1',
						kind: 'Kustomization',
						metadata: { name: 'app', namespace: 'flux-system' },
						spec: { sourceRef: { kind: 'GitRepository', name: 'source' }, path: './' },
						status: { lastAppliedRevision: 'main@sha1:abc' }
					}
				: {
						apiVersion: 'source.toolkit.fluxcd.io/v1',
						kind: 'GitRepository',
						metadata: { name: 'source', namespace: 'flux-system' },
						status: {
							conditions: [{ type: 'Ready', status: 'True' }],
							artifact: {
								url: artifactUrl,
								path: 'gitrepository/flux-system/source/abc.tar.gz'
							}
						}
					},
		getKubeConfig: async (context?: string) => {
			selectedContexts.push(context ?? '');
			return { makeApiClient: () => api };
		}
	}));
	resourceDiff = await importFresh<typeof resourceDiff>(
		'../lib/server/flux/use-cases/resource-diff.ts'
	);
});

afterEach(async () => {
	vi.resetModules();
	vi.restoreAllMocks();
	process.env.PATH = previousPath;
	if (previousFluxSourceControllerService === undefined) {
		delete process.env.FLUX_SOURCE_CONTROLLER_SERVICE;
	} else {
		process.env.FLUX_SOURCE_CONTROLLER_SERVICE = previousFluxSourceControllerService;
	}
	http.globalAgent.destroy();
	http.globalAgent = previousAgent;
	await new Promise<void>((resolve, reject) =>
		server.close((error) => (error ? reject(error) : resolve()))
	);
	await rm(fixtureDir, { recursive: true, force: true });
});

describe('runFluxResourceDiff SDK dry-run requests', () => {
	async function runDiff() {
		return resourceDiff.runFluxResourceDiff({
			clusterId: 'cluster-diff',
			fluxNamespace: 'flux-system',
			name: 'app',
			namespace: 'flux-system',
			resourceType: 'Kustomization'
		});
	}

	test('sends authenticated server-side apply as a dry-run and returns the previewed object', async () => {
		const result = await runDiff();
		const applyRequest = requests.find(({ method }) => method === 'PATCH');

		expect(selectedContexts).toEqual(['cluster-diff']);
		expect(result.diffs).toHaveLength(1);
		expect(result.diffs[0]).toMatchObject({ kind: 'ConfigMap', name: 'app-config' });
		expect(result.diffs[0].error).toBeUndefined();
		expect(applyRequest).toMatchObject({
			method: 'PATCH',
			url: expect.stringContaining('dryRun=All'),
			headers: {
				authorization: 'Bearer diff-token',
				'content-type': 'application/apply-patch+yaml'
			}
		});
		expect(applyRequest?.url).toContain('fieldManager=gyre-drift-check');
		expect(applyRequest?.url).toContain('force=true');
		expect(JSON.parse(applyRequest?.body ?? '{}')).toMatchObject({
			kind: 'ConfigMap',
			metadata: { name: 'app-config', namespace: 'apps' }
		});
		expect(result.diffs[0].desired).toContain('live: state');
	});

	test('returns a per-resource failure when the Kubernetes dry-run rejects the patch', async () => {
		patchStatus = 422;
		const result = await runDiff();

		expect(result.diffs).toHaveLength(1);
		expect(result.diffs[0].error).toContain('server-side apply rejected');
		expect(result.diffs[0].desired).toContain('name: app-config');
		expect(result.diffs[0].live).toBeNull();
	});
});
