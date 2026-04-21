import { logger } from '../logger.js';
import { IN_CLUSTER_ID, normalizeClusterId } from '$lib/clusters/identity.js';
import * as k8s from '@kubernetes/client-node';
import { loadKubeConfig } from './config.js';
import { getClusterKubeconfig } from '../clusters/repository.js';

// Store the base default config separately to avoid reloading it constantly.
// Cache scope: process-local base in-cluster config; cleared during graceful shutdown.
let baseConfig: k8s.KubeConfig | null = null;

// Request cache scope: per-request only, success-only, naturally discarded at request end.
export type ReqCache = Map<string, Promise<k8s.KubeConfig>>;

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

export function clearBaseKubeConfig(): void {
	baseConfig = null;
}
