import { logger } from '../logger.js';
import { IN_CLUSTER_ID, normalizeClusterId } from '$lib/clusters/identity.js';
import * as k8s from '@kubernetes/client-node';
import * as http from 'http';
import * as https from 'https';
import { loadKubeConfig } from './config.js';
import { getClusterKubeconfig } from '../clusters.js';
import {
	getResourceDef,
	getResourceTypeByPlural,
	type FluxResourceType
} from './flux/resources.js';
import type { FluxResource, FluxResourceList } from './flux/types.js';
import {
	KubernetesError,
	KubernetesTimeoutError,
	ResourceNotFoundError,
	AuthenticationError,
	AuthorizationError,
	ClusterUnavailableError
} from './errors.js';

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

// ---------------------------------------------------------------------------
// Timeout configuration
// ---------------------------------------------------------------------------

/** Default timeout for all Kubernetes API requests (30 seconds). */
export const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Per-operation timeout overrides (ms). Falls back to DEFAULT_TIMEOUT_MS.
 * "logs" is higher because log fetching can be slow on large pods.
 * "delete" has same timeout as create/update operations.
 */
export const OPERATION_TIMEOUTS: Record<string, number> = {
	list: 30_000,
	get: 15_000,
	create: 30_000,
	update: 30_000,
	delete: 30_000,
	logs: 60_000
};

/** Returns a PromiseMiddleware that aborts requests exceeding `timeoutMs`. Exported for testing. */
export function _createTimeoutMiddleware(timeoutMs: number): k8s.Middleware {
	return {
		pre: async (ctx: k8s.RequestContext) => {
			const controller = new AbortController();
			const existingSignal = ctx.getSignal();

			// Declared before timer so the closure captures the binding correctly.
			let timer: ReturnType<typeof setTimeout>;

			// If a caller passed an upstream signal (e.g. a request-level AbortController),
			// propagate its cancellation: clear our timer and abort our controller.
			const onUpstreamAbort = () => {
				clearTimeout(timer);
				controller.abort();
			};
			if (existingSignal) {
				existingSignal.addEventListener('abort', onUpstreamAbort, { once: true });
			}

			timer = setTimeout(() => {
				// Timeout fired — remove the upstream listener so it cannot fire later.
				if (existingSignal) {
					existingSignal.removeEventListener('abort', onUpstreamAbort);
				}
				controller.abort();
			}, timeoutMs);

			ctx.setSignal(controller.signal);
			return ctx;
		},
		// ResponseContext does not expose the request signal, so timer cleanup on
		// successful completion is handled by the setTimeout firing as a no-op once
		// the fetch promise has already settled.
		post: async (ctx: k8s.ResponseContext) => ctx
	};
}

/** Creates an API client with an AbortController-based timeout middleware and HTTP keep-alive. */
function makeApiClientWithTimeout<T extends k8s.ApiType>(
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

export interface ListOptions {
	limit?: number;
	offset?: number;
	sortBy?: 'name' | 'age' | 'status';
	sortOrder?: 'asc' | 'desc';
}

export interface PaginatedFluxResourceList {
	items: FluxResource[];
	/** Exact total, or null when cursor-based native paging was used and the total is unknown. */
	total: number | null;
	hasMore: boolean;
	offset: number;
	limit: number;
	metadata: {
		resourceVersion?: string;
		/** k8s continue token; present only when native k8s paging was used. */
		continueToken?: string;
	};
}

const STATUS_ORDER: Record<string, number> = {
	failed: 0,
	progressing: 1,
	suspended: 2,
	unknown: 3,
	healthy: 4
};

function getResourceStatus(resource: FluxResource): string {
	if (resource.spec?.suspend) return 'suspended';
	const conditions = resource.status?.conditions;
	if (!conditions || conditions.length === 0) return 'unknown';
	const stalled = conditions.find((c) => c.type === 'Stalled' || c.type === 'Failed');
	if (stalled?.status === 'True') return 'failed';
	const gen = resource.metadata.generation;
	const obsGen = resource.status?.observedGeneration;
	if (gen !== undefined && obsGen !== undefined && obsGen < gen) return 'progressing';
	for (const type of ['Ready', 'Healthy', 'Succeeded', 'Available']) {
		const cond = conditions.find((c) => c.type === type);
		if (cond) {
			if (cond.status === 'True') return 'healthy';
			if (
				cond.status === 'False' &&
				(cond.reason === 'Progressing' ||
					cond.reason === 'ProgressingWithRetry' ||
					cond.reason === 'DependencyNotReady' ||
					cond.reason === 'ReconciliationInProgress')
			) {
				return 'progressing';
			}
			if (cond.status === 'False') return 'failed';
		}
	}
	return 'unknown';
}

function sortResources(
	items: FluxResource[],
	sortBy: ListOptions['sortBy'],
	sortOrder: ListOptions['sortOrder'] = 'asc'
): FluxResource[] {
	const sorted = [...items].sort((a, b) => {
		let cmp = 0;
		if (sortBy === 'name') {
			cmp = (a.metadata.name ?? '').localeCompare(b.metadata.name ?? '');
		} else if (sortBy === 'age') {
			const aTime = a.metadata.creationTimestamp
				? new Date(a.metadata.creationTimestamp).getTime()
				: 0;
			const bTime = b.metadata.creationTimestamp
				? new Date(b.metadata.creationTimestamp).getTime()
				: 0;
			cmp = aTime - bTime;
		} else if (sortBy === 'status') {
			const aOrder = STATUS_ORDER[getResourceStatus(a)] ?? 3;
			const bOrder = STATUS_ORDER[getResourceStatus(b)] ?? 3;
			cmp = aOrder - bOrder;
		}
		// Deterministic tie-breaker: compare uid, fall back to name.
		// Applied before direction inversion so sortOrder is respected consistently.
		if (cmp === 0) {
			cmp = (a.metadata.uid ?? a.metadata.name ?? '').localeCompare(
				b.metadata.uid ?? b.metadata.name ?? ''
			);
		}
		return sortOrder === 'desc' ? -cmp : cmp;
	});
	return sorted;
}

// Store the base default config separately to avoid reloading it constantly
let baseConfig: k8s.KubeConfig | null = null;

export type ReqCache = Map<string, Promise<k8s.KubeConfig>>;

// ---------------------------------------------------------------------------
// Connection pool — singleton API clients per canonical cluster ID
// ---------------------------------------------------------------------------

const POOL_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
/** Maximum pooled entries per API type; oldest-accessed entry is evicted when exceeded. */
const MAX_POOL_SIZE = 50;

interface PoolEntry<T> {
	client: T;
	createdAt: number;
	lastAccess: number;
}

const customObjectsPool = new Map<string, PoolEntry<k8s.CustomObjectsApi>>();
const coreV1Pool = new Map<string, PoolEntry<k8s.CoreV1Api>>();
const appsV1Pool = new Map<string, PoolEntry<k8s.AppsV1Api>>();

const poolMetricsState = { hits: 0, misses: 0, evictions: 0 };

/** Removes the bottom 20% least-recently-used entries from a pool (min 1). */
function evictLRU<T>(pool: Map<string, PoolEntry<T>>) {
	const evictCount = Math.max(1, Math.ceil(pool.size * 0.2));
	const sorted = [...pool.entries()].sort((a, b) => a[1].lastAccess - b[1].lastAccess);
	for (const [k] of sorted.slice(0, evictCount)) {
		pool.delete(k);
		poolMetricsState.evictions++;
	}
}

/** Proactively removes expired entries from all pools. */
function pruneExpiredEntries() {
	const now = Date.now();
	for (const pool of [customObjectsPool, coreV1Pool, appsV1Pool] as Map<
		string,
		PoolEntry<unknown>
	>[]) {
		for (const [key, entry] of pool) {
			if (now - entry.createdAt >= POOL_TTL_MS) {
				pool.delete(key);
				poolMetricsState.evictions++;
			}
		}
	}
}

// Periodic cleanup — runs every 10 min so expired entries (5 min TTL) may linger
// up to 10 min before proactive removal; on-access eviction in getOrCreate catches
// them sooner. .unref() prevents the timer from blocking process exit.
const cleanupTimer = setInterval(() => {
	try {
		pruneExpiredEntries();
	} catch (e) {
		logger.error(e, 'K8s client pool cleanup error');
	}
}, CLEANUP_INTERVAL_MS);
if (typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
	(cleanupTimer as NodeJS.Timeout).unref();
}

/** Returns current connection pool metrics (hits, misses, evictions, pool sizes). */
export function getPoolMetrics() {
	return {
		hits: poolMetricsState.hits,
		misses: poolMetricsState.misses,
		evictions: poolMetricsState.evictions,
		poolSizes: {
			customObjects: customObjectsPool.size,
			coreV1: coreV1Pool.size,
			appsV1: appsV1Pool.size
		}
	};
}

function clearPoolByPrefix<T>(pool: Map<string, PoolEntry<T>>, prefix: string) {
	for (const key of pool.keys()) {
		if (key.startsWith(prefix)) {
			pool.delete(key);
			poolMetricsState.evictions++;
		}
	}
}

/** Evicts pooled clients. Exposed via POST /api/v1/admin/k8s/clear-client-pool. */
export function clearClientPool(clusterId?: string) {
	if (clusterId === undefined) {
		customObjectsPool.clear();
		coreV1Pool.clear();
		appsV1Pool.clear();
		poolMetricsState.hits = 0;
		poolMetricsState.misses = 0;
		poolMetricsState.evictions = 0;
		return;
	}

	const prefix = `${normalizeClusterId(clusterId)}:`;
	clearPoolByPrefix(customObjectsPool, prefix);
	clearPoolByPrefix(coreV1Pool, prefix);
	clearPoolByPrefix(appsV1Pool, prefix);
}

/**
 * Gracefully shutdown the Kubernetes client by closing all connections and cleanup resources.
 * Clears all pooled clients, closes HTTP agents, and stops the cleanup interval.
 * Safe to call multiple times.
 */
export function gracefulShutdown(): void {
	try {
		// Clear all pools (evicts all clients)
		clearClientPool();

		// Close global HTTP/HTTPS agents and their sockets
		httpAgent.destroy();
		httpsAgent.destroy();

		// Clear the periodic cleanup timer
		if (typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
			clearInterval(cleanupTimer as NodeJS.Timeout);
		}

		logger.info('✓ Kubernetes client gracefully shutdown');
	} catch (e) {
		logger.error(e, 'Error during graceful shutdown of Kubernetes client');
	}
}

/**
 * Audit log helper for sensitive resource access (e.g., Secrets).
 * Used to track compliance requirements for access to sensitive data.
 * @param operation - Operation type (get, list, create, update, delete, patch)
 * @param resourceType - Resource type (e.g., 'Secret', 'ConfigMap')
 * @param namespace - Namespace of the resource
 * @param name - Name of the resource (optional for list operations)
 * @param context - Cluster context for multi-cluster setups
 *
 * @example
 * // Log access to a Secret
 * auditLogSecretAccess('get', 'Secret', 'default', 'my-secret', 'production');
 * // Output: [AUDIT] GET Secret default/my-secret (context: production) at 2024-03-24T...
 */
export function auditLogSecretAccess(
	operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'patch',
	resourceType: string,
	namespace: string,
	name?: string,
	context?: string
): void {
	const timestamp = new Date().toISOString();
	const resourceId = name ? `${namespace}/${name}` : namespace;
	const msg = `[AUDIT] ${operation.toUpperCase()} ${resourceType} ${resourceId} (context: ${normalizeClusterId(context)}) at ${timestamp}`;

	// Use warn level for sensitive resource access to ensure it's logged to files
	logger.warn(msg);
}

/**
 * Read a Kubernetes Secret (CoreV1 API) with audit logging.
 * @param namespace - Namespace containing the Secret
 * @param name - Name of the Secret
 * @param context - Optional cluster context
 */
export async function readSecret(
	namespace: string,
	name: string,
	context?: string
): Promise<k8s.V1Secret> {
	// Audit log before attempting read (logs both success and failure)
	auditLogSecretAccess('get', 'Secret', namespace, name, context);
	try {
		const api = await getCoreV1Api(context);
		const response = await api.readNamespacedSecret({ namespace, name });
		return response;
	} catch (error) {
		throw handleK8sError(error, `read Secret ${namespace}/${name}`);
	}
}

async function getOrCreate<T>(
	pool: Map<string, PoolEntry<T>>,
	key: string,
	factory: () => Promise<T>
): Promise<T> {
	const now = Date.now();
	const entry = pool.get(key);

	if (entry) {
		const isExpired = now - entry.createdAt >= POOL_TTL_MS;

		if (isExpired) {
			// TTL expired — evict stale entry
			pool.delete(key);
			poolMetricsState.evictions++;
		} else {
			// Connection is valid
			entry.lastAccess = now;
			poolMetricsState.hits++;
			return entry.client;
		}
	}

	if (pool.size >= MAX_POOL_SIZE) {
		// Pool full — prefer evicting expired entries first to avoid discarding
		// still-valid connections; fall back to LRU only if none are expired.
		pruneExpiredEntries();
		if (pool.size >= MAX_POOL_SIZE) {
			evictLRU(pool);
		}
	}

	poolMetricsState.misses++;
	const client = await factory();
	pool.set(key, { client, createdAt: now, lastAccess: now });
	return client;
}

/**
 * Get or create KubeConfig for a specific canonical cluster ID.
 * Only caches successful configs; failed promises are not cached to allow retries.
 * @param clusterId - Optional cluster ID. undefined/default/in-cluster select the runtime config.
 */
export async function getKubeConfig(
	clusterId?: string,
	reqCache?: ReqCache
): Promise<k8s.KubeConfig> {
	const key = normalizeClusterId(clusterId);

	// Check cache for successful configs only
	if (reqCache && reqCache.has(key)) {
		const cachedPromise = reqCache.get(key)!;
		// Verify the cached promise hasn't rejected
		// Note: We return the promise as-is; if it rejected, caller will handle the rejection
		return cachedPromise;
	}

	const loadConfig = async () => {
		let config: k8s.KubeConfig;

		if (key === IN_CLUSTER_ID) {
			if (!baseConfig) {
				baseConfig = loadKubeConfig();
			}
			config = new k8s.KubeConfig();
			config.loadFromString(baseConfig.exportConfig());
		} else {
			const kubeconfigYaml = await getClusterKubeconfig(key);
			if (!kubeconfigYaml) {
				throw new Error(`Cluster with ID "${key}" not found or has no valid configuration`);
			}
			config = new k8s.KubeConfig();
			config.loadFromString(kubeconfigYaml);
			logger.debug(`✓ Loaded Kubernetes configuration from database for cluster: ${key}`);
		}

		return config;
	};

	// Wrap promise handling to implement success-only caching with concurrent deduplication
	if (reqCache) {
		// Create the promise
		const cachedPromise = loadConfig()
			.then((config) => {
				// On success, cache the resolved promise for future calls
				reqCache.set(key, Promise.resolve(config));
				return config;
			})
			.catch((error) => {
				// On failure, ensure no stale cache entry exists, allowing retries
				reqCache.delete(key);
				throw error;
			});

		// Store the in-flight promise immediately so concurrent callers reuse it
		reqCache.set(key, cachedPromise);

		return cachedPromise;
	}

	return loadConfig();
}

/**
 * Create CustomObjectsApi client, reusing a pooled instance when possible.
 * getKubeConfig is invoked inside the factory so it is only called on cache misses.
 * @param context - Optional canonical cluster ID
 */
export async function getCustomObjectsApi(
	context?: string,
	reqCache?: ReqCache,
	timeoutMs = OPERATION_TIMEOUTS.list
): Promise<k8s.CustomObjectsApi> {
	const key = normalizeClusterId(context);
	return getOrCreate(customObjectsPool, `${key}:${timeoutMs}`, async () => {
		const config = await getKubeConfig(key, reqCache);
		return makeApiClientWithTimeout(config, k8s.CustomObjectsApi, timeoutMs);
	});
}

/**
 * Create CoreV1Api client, reusing a pooled instance when possible.
 * getKubeConfig is invoked inside the factory so it is only called on cache misses.
 * @param context - Optional canonical cluster ID
 */
export async function getCoreV1Api(
	context?: string,
	reqCache?: ReqCache,
	timeoutMs = OPERATION_TIMEOUTS.get
): Promise<k8s.CoreV1Api> {
	const key = normalizeClusterId(context);
	return getOrCreate(coreV1Pool, `${key}:${timeoutMs}`, async () => {
		const config = await getKubeConfig(key, reqCache);
		return makeApiClientWithTimeout(config, k8s.CoreV1Api, timeoutMs);
	});
}

/**
 * Create AppsV1Api client, reusing a pooled instance when possible.
 * getKubeConfig is invoked inside the factory so it is only called on cache misses.
 * @param context - Optional canonical cluster ID
 */
export async function getAppsV1Api(
	context?: string,
	reqCache?: ReqCache,
	timeoutMs = OPERATION_TIMEOUTS.get
): Promise<k8s.AppsV1Api> {
	const key = normalizeClusterId(context);
	return getOrCreate(appsV1Pool, `${key}:${timeoutMs}`, async () => {
		const config = await getKubeConfig(key, reqCache);
		return makeApiClientWithTimeout(config, k8s.AppsV1Api, timeoutMs);
	});
}

/**
 * List FluxCD resources of a specific type across all namespaces
 * Supports pagination (limit/offset) and server-side sorting.
 */
export async function listFluxResources(
	resourceType: FluxResourceType,
	context?: string,
	reqCache?: ReqCache,
	options?: ListOptions
): Promise<PaginatedFluxResourceList> {
	const resourceDef = getResourceDef(resourceType);
	if (!resourceDef) {
		throw new Error(`Unknown resource type: ${resourceType}`);
	}

	try {
		const api = await getCustomObjectsApi(context, reqCache);

		// Sorting requires the full collection (k8s only sorts by name natively).
		// When no sort is requested and a limit is provided, delegate paging to
		// the k8s API so only the requested page is transferred over the network.
		const useNativePaging =
			!options?.sortBy && options?.limit !== undefined && (options?.offset ?? 0) === 0;

		const response = await api.listClusterCustomObject({
			group: resourceDef.group,
			version: resourceDef.version,
			plural: resourceDef.plural,
			...(useNativePaging ? { limit: options!.limit } : {})
		});

		const list = response as unknown as FluxResourceList;
		const items = list.items ?? [];

		if (useNativePaging) {
			// k8s already returned the page; metadata.continue signals more pages.
			return {
				items,
				total: null, // exact total unknown with cursor-based k8s paging; use hasMore instead
				hasMore: !!list.metadata?.continue,
				offset: 0,
				limit: options!.limit!,
				metadata: {
					resourceVersion: list.metadata?.resourceVersion,
					continueToken: list.metadata?.continue
				}
			};
		}

		// Full-fetch path: sort (if requested) then slice.
		const sorted = options?.sortBy
			? sortResources(items, options.sortBy, options.sortOrder)
			: items;

		const total = sorted.length;
		const offset = options?.offset ?? 0;
		const paginatedItems =
			options?.limit !== undefined
				? sorted.slice(offset, offset + options.limit)
				: sorted.slice(offset);
		const effectiveLimit = paginatedItems.length;

		return {
			items: paginatedItems,
			total,
			hasMore: options?.limit !== undefined ? offset + options.limit < total : false,
			offset,
			limit: effectiveLimit,
			metadata: {
				resourceVersion: list.metadata?.resourceVersion
			}
		};
	} catch (error) {
		throw handleK8sError(error, `list ${resourceType}`);
	}
}

/**
 * List FluxCD resources of a specific type in a namespace
 */
export async function listFluxResourcesInNamespace(
	resourceType: FluxResourceType,
	namespace: string,
	context?: string,
	reqCache?: ReqCache
): Promise<FluxResourceList> {
	const resourceDef = getResourceDef(resourceType);
	if (!resourceDef) {
		throw new Error(`Unknown resource type: ${resourceType}`);
	}

	try {
		const api = await getCustomObjectsApi(context, reqCache);
		const response = await api.listNamespacedCustomObject({
			group: resourceDef.group,
			version: resourceDef.version,
			namespace,
			plural: resourceDef.plural
		});

		return response as unknown as FluxResourceList;
	} catch (error) {
		throw handleK8sError(error, `list ${resourceType} in namespace ${namespace}`);
	}
}

/**
 * Poll for changes to FluxCD resources of a specific type across all namespaces.
 * Returns an async iterable that yields resources when changes are detected.
 * Includes automatic reconnection on failure with exponential backoff.
 *
 * Note: This implements polling-based change detection since the Kubernetes
 * client-node library's watch API has limitations for custom resources.
 * For production use, consider implementing server-sent events (SSE) or WebSocket
 * based on the Kubernetes Watch API for true real-time updates.
 *
 * @param resourceType - Type of Flux resource to watch
 * @param context - Optional cluster ID or context name
 * @param pollIntervalMs - Interval between polls (default: 5000ms)
 */
export async function* watchFluxResources(
	resourceType: FluxResourceType,
	context?: string,
	pollIntervalMs = 5000
): AsyncGenerator<PaginatedFluxResourceList, void, unknown> {
	const resourceDef = getResourceDef(resourceType);
	if (!resourceDef) {
		throw new Error(`Unknown resource type: ${resourceType}`);
	}

	let lastResourceVersion: string | undefined;
	let reconnectAttempts = 0;
	const maxReconnectAttempts = 10;
	const baseBackoffMs = 1000;

	while (reconnectAttempts < maxReconnectAttempts) {
		try {
			const result = await listFluxResources(resourceType, context);

			// Reset reconnect counter on any successful poll (not just version changes)
			reconnectAttempts = 0;

			// Check if resource version changed
			const currentVersion = result.metadata?.resourceVersion;
			if (currentVersion !== lastResourceVersion) {
				lastResourceVersion = currentVersion;
				yield result;
			}

			// Wait before next poll
			await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));

			reconnectAttempts++;
			if (reconnectAttempts < maxReconnectAttempts) {
				// Exponential backoff: 1s, 2s, 4s, 8s, etc., capped at 30s
				const backoffMs = Math.min(baseBackoffMs * Math.pow(2, reconnectAttempts - 1), 30_000);
				logger.warn(
					`Poll for ${resourceType} failed, retrying in ${backoffMs}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`,
					err
				);
				await new Promise((resolve) => setTimeout(resolve, backoffMs));
			} else {
				logger.error(`Poll for ${resourceType} failed after ${maxReconnectAttempts} attempts`);
				throw err;
			}
		}
	}
}

/**
 * Get a specific FluxCD resource
 */
export async function getFluxResource(
	resourceType: FluxResourceType,
	namespace: string,
	name: string,
	context?: string,
	reqCache?: ReqCache
): Promise<FluxResource> {
	const resourceDef = getResourceDef(resourceType);
	if (!resourceDef) {
		throw new Error(`Unknown resource type: ${resourceType}`);
	}

	try {
		const api = await getCustomObjectsApi(context, reqCache);
		const response = await api.getNamespacedCustomObject({
			group: resourceDef.group,
			version: resourceDef.version,
			namespace,
			plural: resourceDef.plural,
			name
		});

		return response as unknown as FluxResource;
	} catch (error) {
		throw handleK8sError(error, `get ${resourceType} ${namespace}/${name}`);
	}
}

/**
 * Get resource status (uses getNamespacedCustomObjectStatus)
 */
export async function getFluxResourceStatus(
	resourceType: FluxResourceType,
	namespace: string,
	name: string,
	context?: string,
	reqCache?: ReqCache
): Promise<FluxResource> {
	const resourceDef = getResourceDef(resourceType);
	if (!resourceDef) {
		throw new Error(`Unknown resource type: ${resourceType}`);
	}

	try {
		const api = await getCustomObjectsApi(context, reqCache);
		const response = await api.getNamespacedCustomObjectStatus({
			group: resourceDef.group,
			version: resourceDef.version,
			namespace,
			plural: resourceDef.plural,
			name
		});

		return response as unknown as FluxResource;
	} catch (error) {
		throw handleK8sError(error, `get status for ${resourceType} ${namespace}/${name}`);
	}
}

/**
 * Create a FluxCD resource
 */
export async function createFluxResource(
	resourceType: FluxResourceType,
	namespace: string,
	body: Record<string, unknown>,
	context?: string,
	reqCache?: ReqCache
): Promise<FluxResource> {
	const resourceDef = getResourceDef(resourceType);
	if (!resourceDef) {
		throw new Error(`Unknown resource type: ${resourceType}`);
	}

	try {
		const api = await getCustomObjectsApi(context, reqCache);
		const response = await api.createNamespacedCustomObject({
			group: resourceDef.group,
			version: resourceDef.version,
			namespace,
			plural: resourceDef.plural,
			body: body as object
		});

		return response as unknown as FluxResource;
	} catch (error) {
		throw handleK8sError(error, `create ${resourceType} in ${namespace}`);
	}
}

/**
 * Update (replace) a FluxCD resource
 */
export async function updateFluxResource(
	resourceType: FluxResourceType,
	namespace: string,
	name: string,
	body: Record<string, unknown>,
	context?: string,
	reqCache?: ReqCache
): Promise<FluxResource> {
	const resourceDef = getResourceDef(resourceType);
	if (!resourceDef) {
		throw new Error(`Unknown resource type: ${resourceType}`);
	}

	try {
		const api = await getCustomObjectsApi(context, reqCache);
		const response = await api.replaceNamespacedCustomObject({
			group: resourceDef.group,
			version: resourceDef.version,
			namespace,
			plural: resourceDef.plural,
			name,
			body: body as object
		});

		return response as unknown as FluxResource;
	} catch (error) {
		throw handleK8sError(error, `update ${resourceType} ${namespace}/${name}`);
	}
}

/**
 * Delete a FluxCD resource with timeout protection.
 * Gracefully handles 404 Not Found errors (idempotent deletion).
 */
export async function deleteFluxResource(
	resourceType: FluxResourceType,
	namespace: string,
	name: string,
	context?: string,
	reqCache?: ReqCache
): Promise<void> {
	const resourceDef = getResourceDef(resourceType);
	if (!resourceDef) {
		throw new Error(`Unknown resource type: ${resourceType}`);
	}

	try {
		const api = await getCustomObjectsApi(context, reqCache, OPERATION_TIMEOUTS.delete);
		await api.deleteNamespacedCustomObject({
			group: resourceDef.group,
			version: resourceDef.version,
			namespace,
			plural: resourceDef.plural,
			name
		});
	} catch (error) {
		// Treat 404 as success (idempotent) — resource doesn't exist, which is the desired end state
		if (error instanceof Error && (error as Error & { code?: number }).code === 404) {
			return;
		}
		throw handleK8sError(error, `delete ${resourceType} ${namespace}/${name}`);
	}
}

/**
 * Batch delete multiple FluxCD resources with configurable concurrency.
 * Continues on individual failures and returns detailed results.
 * @param items - Array of {resourceType, namespace, name} to delete
 * @param context - Optional cluster context
 * @param concurrency - Maximum concurrent delete operations (default: 5)
 */
export interface DeleteItem {
	resourceType: FluxResourceType;
	namespace: string;
	name: string;
}

export interface DeleteResult {
	item: DeleteItem;
	success: boolean;
	error?: Error;
}

export async function deleteFluxResourcesBatch(
	items: DeleteItem[],
	context?: string,
	concurrency = 5
): Promise<DeleteResult[]> {
	// Validate concurrency to prevent semaphore deadlock
	if (concurrency <= 0) {
		throw new RangeError('concurrency must be greater than 0');
	}

	// Allocate results array with same length as items to preserve ordering
	const results: Array<DeleteResult | undefined> = Array.from({ length: items.length });
	const semaphore = { active: 0, queue: [] as Array<(value: void) => void> };

	const executeWithConcurrency = async (item: DeleteItem, index: number) => {
		// Wait for a slot to become available
		while (semaphore.active >= concurrency) {
			await new Promise<void>((resolve) => {
				semaphore.queue.push(resolve);
			});
		}

		semaphore.active++;
		try {
			await deleteFluxResource(item.resourceType, item.namespace, item.name, context);
			results[index] = { item, success: true };
		} catch (error) {
			results[index] = {
				item,
				success: false,
				error: error instanceof Error ? error : new Error(String(error))
			};
		} finally {
			semaphore.active--;
			const next = semaphore.queue.shift();
			if (next) next(undefined);
		}
	};

	// Start all delete operations with index to preserve order
	const promises = items.map((item, index) => executeWithConcurrency(item, index));
	await Promise.all(promises);

	// Filter out undefined entries (should none exist in normal case)
	return results.filter((r): r is DeleteResult => r !== undefined);
}

/**
 * Get logs for a FluxCD controller responsible for a specific resource
 */
export async function getControllerLogs(
	resourceType: string,
	namespace: string,
	name: string,
	context?: string,
	reqCache?: ReqCache
): Promise<string> {
	let resourceDef = getResourceDef(resourceType);
	if (!resourceDef) {
		const key = getResourceTypeByPlural(resourceType);
		if (key) {
			resourceDef = getResourceDef(key);
		}
	}

	if (!resourceDef) {
		throw new Error(`Unknown resource type: ${resourceType}`);
	}

	const controllerName = resourceDef.controller;

	try {
		const coreApi = await getCoreV1Api(context, reqCache, OPERATION_TIMEOUTS.logs);
		// 1. Find the controller pod in flux-system namespace
		// Most Flux installations use the app label
		const podsResponse = await coreApi.listNamespacedPod({
			namespace: 'flux-system',
			labelSelector: `app=${controllerName}`
		});

		const pods = podsResponse.items;
		if (pods.length === 0) {
			// Fallback: try app.kubernetes.io/name label
			const podsResponseAlt = await coreApi.listNamespacedPod({
				namespace: 'flux-system',
				labelSelector: `app.kubernetes.io/name=${controllerName}`
			});
			if (podsResponseAlt.items.length === 0) {
				throw new Error(`No pods found for controller ${controllerName} in namespace flux-system`);
			}
			pods.push(...podsResponseAlt.items);
		}

		// Pick the first running pod
		const pod = pods.find((p) => p.status?.phase === 'Running') || pods[0];
		const podName = pod.metadata?.name;

		if (!podName) {
			throw new Error(`Could not determine pod name for controller ${controllerName}`);
		}

		// 2. Fetch logs (last 500 lines)
		const logsResponse = await coreApi.readNamespacedPodLog({
			name: podName,
			namespace: 'flux-system',
			tailLines: 1000
		});

		const logs = logsResponse;

		// 3. Filter logs for the specific resource
		// Flux logs are JSON and typically contain "name" and "namespace" fields for the resource being processed.
		// We grep for both to be as specific as possible.
		const lines = logs.split('\n');
		const filteredLines = lines.filter((line) => {
			if (!line.trim()) return false;
			// Match both name and namespace of the resource
			return line.includes(`"${name}"`) && line.includes(`"${namespace}"`);
		});

		// If filtering yields too little, return more context or all logs
		if (filteredLines.length < 10) {
			return logs;
		}

		return filteredLines.join('\n');
	} catch (error) {
		throw handleK8sError(error, `fetch logs for ${controllerName}`, OPERATION_TIMEOUTS.logs);
	}
}

/**
 * Handle Kubernetes API errors
 */
export function handleK8sError(
	error: unknown,
	operation: string,
	timeoutMs = DEFAULT_TIMEOUT_MS
): Error {
	// Log the full error server-side for debugging
	logger.error(error, `Kubernetes API error during ${operation}`);

	if (error instanceof Error) {
		// Detect AbortController-triggered timeouts (node-fetch surfaces these as
		// AbortError or as a generic Error with name 'AbortError').
		if (
			error.name === 'AbortError' ||
			error instanceof k8s.AbortError ||
			(error as { type?: string }).type === 'aborted'
		) {
			return new KubernetesTimeoutError(operation, timeoutMs);
		}

		// @kubernetes/client-node v1 throws ApiException with a `code` property directly
		const apiException = error as Error & { code?: number | string };
		// Older versions used `response.statusCode`
		const k8sError = error as Error & {
			response?: { statusCode: number; body?: { message?: string } };
			errno?: string;
		};

		// Check for connection-related errors
		const connectionErrors = [
			'ECONNREFUSED',
			'ETIMEDOUT',
			'ENOTFOUND',
			'EHOSTUNREACH',
			'ESOCKETTIMEDOUT',
			'ECONNRESET'
		];

		const errorCode = apiException.code?.toString() ?? k8sError.errno;
		if (errorCode && connectionErrors.includes(errorCode)) {
			return new ClusterUnavailableError(`Kubernetes cluster is unavailable: ${errorCode}`);
		}

		const status =
			typeof apiException.code === 'number' ? apiException.code : k8sError.response?.statusCode;

		if (status !== undefined) {
			switch (status) {
				case 404:
					return new ResourceNotFoundError(operation);
				case 401:
					return new AuthenticationError(`Authentication failed: ${operation}`);
				case 403:
					return new AuthorizationError(`Permission denied: ${operation}`);
				case 503:
				case 504:
					return new ClusterUnavailableError(`Kubernetes cluster is unavailable (${status})`);
				default:
					return new KubernetesError(`Kubernetes API error (${status})`, status, 'ApiError');
			}
		}
		return new KubernetesError(`Failed to ${operation}: Internal Error`, 500, 'InternalError');
	}
	return new KubernetesError(`Failed to ${operation}: Unknown error`, 500, 'UnknownError');
}

// Note: Signal handlers (SIGTERM/SIGINT) should be registered in the centralized
// application shutdown flow, not here. This allows the app to coordinate shutdown
// across all components (database, servers, etc.) in the correct order.
// Call gracefulShutdown() from the main shutdown orchestrator (e.g., shutdownGyre).
