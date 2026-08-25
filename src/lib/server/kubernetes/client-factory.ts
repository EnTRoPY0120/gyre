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
	return new Promise((resolve) => {
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
	send(request: k8s.RequestContext): Promise<k8s.ResponseContext> {
		return new Promise((resolve, reject) => {
			const url = new URL(request.getUrl());
			const transport = url.protocol === 'https:' ? https : http;
			const body = request.getBody();
			const headers = { ...request.getHeaders() };
			const agent = url.protocol === 'https:' ? httpsAgent : httpAgent;

			const req = transport.request(
				url,
				{
					method: request.getHttpMethod(),
					headers,
					agent
				},
				(res) => {
					void collectResponse(res).then(resolve);
				}
			);

			if (!attachAbortSignal(req, request.getSignal())) return;

			req.on('error', reject);
			writeRequestBody(req, body);
		});
	}
}

const nodeHttpLibrary = k8s.wrapHttpLibrary(new NodeHttpLibrary());

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

// Note: HTTP_PROXY/HTTPS_PROXY environment variables are respected at the Node.js
// level for global HTTP agent behavior. For explicit proxy agent support (e.g., with
// HttpProxyAgent/HttpsProxyAgent packages), implement in a future enhancement.

/** Creates an API client with an AbortController-based timeout middleware and HTTP keep-alive. */
export function makeApiClientWithTimeout<T extends k8s.ApiType>(
	kubeConfig: k8s.KubeConfig,
	apiClientType: k8s.ApiConstructor<T>,
	timeoutMs: number
): T {
	const cluster = kubeConfig.getCurrentCluster();
	if (!cluster) throw new Error('No active cluster!');
	const baseServerConfig = new k8s.ServerConfiguration(cluster.server, {});

	const config = k8s.createConfiguration({
		baseServer: baseServerConfig,
		httpApi: nodeHttpLibrary,
		authMethods: { default: kubeConfig },
		promiseMiddleware: [
			{
				pre: async (ctx: k8s.RequestContext) => {
					return _createTimeoutMiddleware(timeoutMs).pre(ctx);
				},
				post: async (ctx: k8s.ResponseContext) => ctx
			}
		]
	});
	return new apiClientType(config);
}

export function destroyHttpAgents(): void {
	httpAgent.destroy();
	httpsAgent.destroy();
}

export function logKubernetesShutdownComplete(): void {
	logger.info('✓ Kubernetes client gracefully shutdown');
}
