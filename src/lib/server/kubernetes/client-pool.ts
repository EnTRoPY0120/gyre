import { logger } from '../logger.js';
import { normalizeClusterId } from '$lib/clusters/identity.js';
import * as k8s from '@kubernetes/client-node';
import { OPERATION_TIMEOUTS } from './timeouts.js';
import {
	destroyHttpAgents,
	logKubernetesShutdownComplete,
	makeApiClientWithTimeout
} from './client-factory.js';
import { clearBaseKubeConfig, getKubeConfig, type ReqCache } from './kubeconfig-provider.js';

// Connection pool cache scope: process-local, TTL/LRU, explicit clear via admin endpoint.
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
		destroyHttpAgents();
		clearBaseKubeConfig();

		// Clear the periodic cleanup timer
		if (typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
			clearInterval(cleanupTimer as NodeJS.Timeout);
		}

		logKubernetesShutdownComplete();
	} catch (e) {
		logger.error(e, 'Error during graceful shutdown of Kubernetes client');
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
