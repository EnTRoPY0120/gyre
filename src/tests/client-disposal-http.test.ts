import * as http from 'node:http';
import * as https from 'node:https';
import { connect, type Socket } from 'node:net';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as k8s from '@kubernetes/client-node';
import { afterEach, expect, test, vi } from 'vitest';
import {
	disposeKubernetesClient,
	makeApiClientWithTimeout
} from '../lib/server/kubernetes/client-factory.js';
import { runClusterHealthChecks } from '../lib/server/clusters/health-checks.js';

const servers: http.Server[] = [];
const clients: object[] = [];
const sockets = new Set<Socket>();
let certificateDir: string | undefined;

afterEach(async () => {
	for (const client of clients.splice(0)) disposeKubernetesClient(client);
	for (const socket of sockets) socket.destroy();
	for (const server of servers.splice(0))
		await new Promise<void>((resolve) => server.close(() => resolve()));
	if (certificateDir) rmSync(certificateDir, { recursive: true, force: true });
	certificateDir = undefined;
	vi.restoreAllMocks();
});

async function serve(tls: boolean, handler: http.RequestListener) {
	let server: http.Server;
	let caData: string | undefined;
	if (tls) {
		certificateDir = mkdtempSync(join(tmpdir(), 'gyre-client-tls-'));
		const key = join(certificateDir, 'key.pem');
		const cert = join(certificateDir, 'cert.pem');
		execFileSync(
			'openssl',
			[
				'req',
				'-x509',
				'-newkey',
				'rsa:2048',
				'-nodes',
				'-days',
				'1',
				'-subj',
				'/CN=localhost',
				'-addext',
				'subjectAltName=IP:127.0.0.1',
				'-keyout',
				key,
				'-out',
				cert
			],
			{ stdio: 'ignore' }
		);
		caData = readFileSync(cert).toString('base64');
		server = https.createServer({ key: readFileSync(key), cert: readFileSync(cert) }, handler);
	} else server = http.createServer(handler);
	servers.push(server);
	server.on('connection', (socket) => {
		sockets.add(socket);
		socket.once('close', () => sockets.delete(socket));
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('No server address');
	const config = new k8s.KubeConfig();
	config.loadFromOptions({
		clusters: [
			{
				name: 'test',
				server: `${tls ? 'https' : 'http'}://127.0.0.1:${address.port}`,
				skipTLSVerify: !tls,
				caData
			}
		],
		users: [{ name: 'test', token: 'first-token' }],
		contexts: [{ name: 'test', cluster: 'test', user: 'test' }],
		currentContext: 'test'
	});
	return config;
}
function respond(response: http.ServerResponse) {
	response.writeHead(200, { 'content-type': 'application/json' });
	response.end(
		JSON.stringify({ kind: 'NamespaceList', apiVersion: 'v1', items: [], gitVersion: 'v1.37.0' })
	);
}
async function client(config: k8s.KubeConfig, timeout = 1000) {
	const api = await makeApiClientWithTimeout(config, k8s.CoreV1Api, timeout);
	clients.push(api);
	return api;
}

test.each([false, true])(
	'retirement lets active %s requests finish and then closes their connections',
	async (tls) => {
		let response: http.ServerResponse | undefined;
		const config = await serve(tls, (_req, res) => {
			response = res;
		});
		const api = await client(config);
		const request = api.listNamespace();
		await vi.waitFor(() => expect(response).toBeDefined());
		disposeKubernetesClient(api);
		disposeKubernetesClient(api);
		expect(sockets.size).toBe(1);
		respond(response!);
		await expect(request).resolves.toMatchObject({ items: [] });
		await vi.waitFor(() => expect(sockets.size).toBe(0));
		await expect(api.listNamespace()).rejects.toThrow('disposed');
	}
);

test('retirement closes an active connection when its request times out', async () => {
	const config = await serve(false, () => {});
	const api = await client(config, 150);
	const request = api.listNamespace();
	const rejected = expect(request).rejects.toThrow('aborted');
	await vi.waitFor(() => expect(sockets.size).toBe(1));
	disposeKubernetesClient(api);
	await rejected;
	await vi.waitFor(() => expect(sockets.size).toBe(0));
});

test('clients from the same kubeconfig remain isolated and refresh authentication', async () => {
	const authorization: (string | undefined)[] = [];
	const config = await serve(true, (req, res) => {
		authorization.push(req.headers.authorization);
		respond(res);
	});
	const a = await client(config);
	const b = await client(config);
	await a.listNamespace();
	await b.listNamespace();
	disposeKubernetesClient(a);
	config.getCurrentUser()!.token = 'refreshed-token';
	await b.listNamespace();
	expect(authorization).toEqual([
		'Bearer first-token',
		'Bearer first-token',
		'Bearer refreshed-token'
	]);
	disposeKubernetesClient(b);
	await vi.waitFor(() => expect(sockets.size).toBe(0));
});

test('health checks dispose every temporary client on success and failure', async () => {
	let status = 200;
	const config = await serve(false, (_req, res) => {
		if (status === 200) respond(res);
		else {
			res.writeHead(status);
			res.end('{}');
		}
	});
	expect((await runClusterHealthChecks(config)).connected).toBe(true);
	await vi.waitFor(() => expect(sockets.size).toBe(0));
	status = 403;
	expect((await runClusterHealthChecks(config)).connected).toBe(false);
	await vi.waitFor(() => expect(sockets.size).toBe(0));
});

test('constructor failure destroys the allocated agent', async () => {
	const config = await serve(false, (_req, res) => respond(res));
	const destroy = vi.spyOn(http.Agent.prototype, 'destroy');
	class BrokenApi extends k8s.CoreV1Api {
		constructor(...args: ConstructorParameters<typeof k8s.CoreV1Api>) {
			super(...args);
			throw new Error('factory failure');
		}
	}
	await expect(makeApiClientWithTimeout(config, BrokenApi, 1000)).rejects.toThrow(
		'factory failure'
	);
	expect(destroy).toHaveBeenCalledTimes(1);
});

test('preserves HTTP proxy routing and disposes the proxy connection', async () => {
	const paths: string[] = [];
	const config = await serve(false, (req, res) => {
		paths.push(req.url ?? '');
		respond(res);
	});
	const target = new URL(config.getCurrentCluster()!.server);
	const proxy = http.createServer();
	servers.push(proxy);
	const tunnels: string[] = [];
	proxy.on('connect', (request, socket, head) => {
		tunnels.push(request.url ?? '');
		const upstream = connect(Number(target.port), '127.0.0.1', () => {
			socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
			if (head.length) upstream.write(head);
			socket.pipe(upstream);
			upstream.pipe(socket);
		});
		socket.on('error', () => upstream.destroy());
		socket.on('close', () => upstream.destroy());
		upstream.on('error', () => socket.destroy());
	});
	await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve));
	const address = proxy.address();
	if (!address || typeof address === 'string') throw new Error('No proxy address');
	const cluster = config.getCurrentCluster()!;
	cluster.proxyUrl = `http://127.0.0.1:${address.port}`;
	cluster.server = 'http://cluster.invalid';
	const api = await client(config);
	await api.listNamespace();
	expect(tunnels).toEqual(['cluster.invalid:80']);
	expect(paths).toEqual(['/api/v1/namespaces']);
	disposeKubernetesClient(api);
	await vi.waitFor(() => expect(sockets.size).toBe(0));
});

test('releases fresh authentication agents without retiring the transport agent', async () => {
	const config = await serve(false, (_req, res) => respond(res));
	const originalApply = k8s.KubeConfig.prototype.applyToHTTPSOptions;
	let applies = 0;
	const temporaries: ReturnType<typeof vi.spyOn>[] = [];
	vi.spyOn(k8s.KubeConfig.prototype, 'applyToHTTPSOptions').mockImplementation(
		async function (this: k8s.KubeConfig, options) {
			await originalApply.call(this, options);
			if (++applies > 1) {
				const agent = new http.Agent();
				temporaries.push(vi.spyOn(agent, 'destroy'));
				options.agent = agent;
			}
		}
	);
	const api = await client(config);
	await api.listNamespace();
	await api.listNamespace();
	expect(temporaries).toHaveLength(2);
	for (const destroy of temporaries) expect(destroy).toHaveBeenCalledTimes(1);
	disposeKubernetesClient(api);
	await vi.waitFor(() => expect(sockets.size).toBe(0));
});
