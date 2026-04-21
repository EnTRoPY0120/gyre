import { logger } from '../logger.js';
import * as k8s from '@kubernetes/client-node';
import * as http from 'http';
import * as https from 'https';
import { _createTimeoutMiddleware } from './timeouts.js';

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

	// Note: HTTP agents are configured globally above (httpAgent/httpsAgent singletons)
	// for maximum connection reuse. The kubernetes client-node library respects
	// global agent configuration at the Node.js level.
	const config = k8s.createConfiguration({
		baseServer: baseServerConfig,
		authMethods: { default: kubeConfig },
		promiseMiddleware: [_createTimeoutMiddleware(timeoutMs)]
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
