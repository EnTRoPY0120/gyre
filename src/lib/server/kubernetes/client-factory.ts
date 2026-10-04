import { logger } from '../logger.js';
import * as k8s from '@kubernetes/client-node';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { _createTimeoutMiddleware } from './timeouts.js';

function normalizeResponseHeader(value: string | string[] | undefined): string | undefined {
	if (Array.isArray(value)) return value.join(', ');
	if (value === undefined) return undefined;
	return String(value);
}

function createResponseContext(res: http.IncomingMessage, chunks: Buffer[]): k8s.ResponseContext {
	const buffer = Buffer.concat(chunks);
	const responseHeaders: Record<string, string> = {};
	for (const [key, value] of Object.entries(res.headers)) {
		const normalizedValue = normalizeResponseHeader(value);
		if (normalizedValue !== undefined) responseHeaders[key] = normalizedValue;
	}

	return new k8s.ResponseContext(res.statusCode ?? 0, responseHeaders, {
		binary: async () => buffer,
		text: async () => buffer.toString('utf-8'),
		stream: () => null
	});
}

function collectResponse(res: http.IncomingMessage): Promise<k8s.ResponseContext> {
	return new Promise((resolve, reject) => {
		res.once('error', reject);
		res.once('aborted', () => reject(new Error('Response aborted')));
		const chunks: Buffer[] = [];
		res.on('data', (chunk) => {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
		});
		res.on('end', () => resolve(createResponseContext(res, chunks)));
	});
}

function attachAbortSignal(req: http.ClientRequest, signal: AbortSignal | undefined): boolean {
	if (!signal) return true;

	const abort = () => {
		req.destroy(new Error('Request aborted'));
	};
	if (signal.aborted) {
		abort();
		return false;
	}

	signal.addEventListener('abort', abort, { once: true });
	req.on('close', () => signal.removeEventListener('abort', abort));
	return true;
}

function writeRequestBody(req: http.ClientRequest, body: unknown): void {
	if (body === undefined) {
		req.end();
	} else if (typeof body === 'string' || Buffer.isBuffer(body)) {
		req.end(body);
	} else {
		req.end(String(body));
	}
}

class NodeHttpLibrary implements k8s.PromiseHttpLibrary {
	private activeRequests = 0;
	private retired = false;

	constructor(
		private readonly requestHttpAgent: http.Agent,
		private readonly requestHttpsAgent: http.Agent,
		private readonly requestOptions: WeakMap<k8s.RequestContext, https.RequestOptions>,
		private readonly releaseAgents: () => void
	) {}

	dispose(): void {
		this.retired = true;
		if (this.activeRequests === 0) this.releaseAgents();
	}

	send(request: k8s.RequestContext): Promise<k8s.ResponseContext> {
		if (this.retired) return Promise.reject(new Error('Kubernetes client has been disposed'));
		return new Promise((resolve, reject) => {
			const url = new URL(request.getUrl());
			const transport = url.protocol === 'https:' ? https : http;
			const agent = url.protocol === 'https:' ? this.requestHttpsAgent : this.requestHttpAgent;
			const req = transport.request(
				url,
				{
					...this.requestOptions.get(request),
					method: request.getHttpMethod(),
					headers: { ...request.getHeaders() },
					agent
				},
				(res) => {
					void collectResponse(res).then(resolve, reject);
				}
			);
			this.activeRequests++;
			req.once('close', () => {
				this.activeRequests--;
				if (this.retired && this.activeRequests === 0) this.releaseAgents();
			});
			req.on('error', reject);
			if (!attachAbortSignal(req, request.getSignal())) return;
			try {
				writeRequestBody(req, request.getBody());
			} catch (error) {
				req.destroy();
				reject(error);
			}
		});
	}
}

// ---------------------------------------------------------------------------
// HTTP Agent configuration (Keep-Alive support)
// ---------------------------------------------------------------------------

/**
 * HTTP agent with keep-alive enabled for efficient connection reuse.
 * Configuration:
 * - keepAlive: true — Reuse TCP connections across requests
 * - keepAliveMsecs: 30000 — TCP keep-alive probe every 30s
 * - maxSockets: 100 — Limit concurrent connections per agent
 * - maxFreeSockets: 20 — Keep up to 20 idle sockets open
 * - timeout: 30000 — Socket timeout
 */
const httpAgent = new http.Agent({
	keepAlive: true,
	keepAliveMsecs: 30_000,
	maxSockets: 100,
	maxFreeSockets: 20,
	timeout: 30_000
});

/**
 * HTTPS agent with keep-alive enabled.
 * Configuration matches HTTP agent for consistency.
 */
const httpsAgent = new https.Agent({
	keepAlive: true,
	keepAliveMsecs: 30_000,
	maxSockets: 100,
	maxFreeSockets: 20,
	timeout: 30_000
});

const kubeconfigAgents = new Set<http.Agent>();
const clientDisposers = new WeakMap<object, () => void>();

/** Retire client-owned connections after active requests complete or time out. Idempotent. */
export function disposeKubernetesClient(client: object | undefined): void {
	if (client) clientDisposers.get(client)?.();
}

/** Creates an API client with kubeconfig TLS settings, timeouts, and HTTP keep-alive. */
export async function makeApiClientWithTimeout<T extends k8s.ApiType>(
	kubeConfig: k8s.KubeConfig,
	apiClientType: k8s.ApiConstructor<T>,
	timeoutMs: number
): Promise<T> {
	const cluster = kubeConfig.getCurrentCluster();
	if (!cluster) throw new Error('No active cluster!');
	// KubeConfig caches agents. Give each client its own config/agent cache so
	// disposing it cannot close connections belonging to another API client.
	const clientConfig = new k8s.KubeConfig();
	clientConfig.loadFromOptions({
		clusters: kubeConfig.getClusters(),
		users: kubeConfig.getUsers(),
		contexts: kubeConfig.getContexts(),
		currentContext: kubeConfig.getCurrentContext()
	});
	const httpsOptions: https.RequestOptions = {};
	let ownedAgent: http.Agent | undefined;
	let released = false;
	const releaseAgents = () => {
		if (released) return;
		released = true;
		if (ownedAgent) {
			kubeconfigAgents.delete(ownedAgent);
			ownedAgent.destroy();
		}
	};
	try {
		await clientConfig.applyToHTTPSOptions(httpsOptions);
		if (httpsOptions.agent && typeof httpsOptions.agent === 'object') {
			ownedAgent = httpsOptions.agent;
			kubeconfigAgents.add(ownedAgent);
			// Preserve proxy subclasses and their connection behavior.
			if (ownedAgent.constructor === https.Agent || ownedAgent.constructor === http.Agent) {
				Object.assign(ownedAgent, {
					keepAlive: true,
					keepAliveMsecs: 30_000,
					maxSockets: 100,
					maxFreeSockets: 20
				});
				Object.assign((ownedAgent as https.Agent).options, { keepAlive: true, timeout: 30_000 });
			}
		}
		const isHttps = cluster.server.startsWith('https:');
		const requestOptions = new WeakMap<k8s.RequestContext, https.RequestOptions>();
		const transport = new NodeHttpLibrary(
			!isHttps && ownedAgent ? ownedAgent : httpAgent,
			isHttps && ownedAgent ? ownedAgent : httpsAgent,
			requestOptions,
			releaseAgents
		);
		const config = k8s.createConfiguration({
			baseServer: new k8s.ServerConfiguration(cluster.server, {}),
			httpApi: k8s.wrapHttpLibrary(transport),
			authMethods: {
				default: {
					getName: () => 'kubeconfig authentication',
					async applySecurityAuthentication(context: k8s.RequestContext): Promise<void> {
						const options: https.RequestOptions = {};
						try {
							await clientConfig.applyToHTTPSOptions(options);
							for (const [key, value] of Object.entries(options.headers ?? {})) {
								if (value !== undefined) context.setHeaderParam(key, String(value));
							}
							const hasAuthorization = Object.keys(options.headers ?? {}).some(
								(key) => key.toLowerCase() === 'authorization'
							);
							if (options.auth && !hasAuthorization) {
								context.setHeaderParam(
									'Authorization',
									`Basic ${Buffer.from(options.auth).toString('base64')}`
								);
							}
							// Request TLS options carry refreshed client certificates as well as CA/SNI.
							const { agent: _agent, auth: _auth, headers: _headers, ...tlsOptions } = options;
							requestOptions.set(context, tlsOptions);
						} finally {
							// Some authenticators/client-node versions allocate a temporary agent per call.
							if (
								options.agent &&
								typeof options.agent === 'object' &&
								options.agent !== ownedAgent
							)
								options.agent.destroy();
						}
					}
				}
			},
			promiseMiddleware: [
				{
					pre: async (ctx: k8s.RequestContext) => _createTimeoutMiddleware(timeoutMs).pre(ctx),
					post: async (ctx: k8s.ResponseContext) => ctx
				}
			]
		});
		const client = new apiClientType(config);
		clientDisposers.set(client, () => transport.dispose());
		return client;
	} catch (error) {
		// Include agents assigned before an authentication or constructor failure.
		if (!ownedAgent && httpsOptions.agent && typeof httpsOptions.agent === 'object')
			ownedAgent = httpsOptions.agent;
		releaseAgents();
		throw error;
	}
}

export function destroyHttpAgents(): void {
	for (const agent of kubeconfigAgents) {
		agent.destroy();
	}
	kubeconfigAgents.clear();
	httpAgent.destroy();
	httpsAgent.destroy();
}

export function logKubernetesShutdownComplete(): void {
	logger.info('✓ Kubernetes client gracefully shutdown');
}
