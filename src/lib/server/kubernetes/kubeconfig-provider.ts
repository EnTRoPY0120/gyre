import { logger } from '../logger.js';
import { IN_CLUSTER_ID, normalizeClusterId } from '$lib/clusters/identity.js';
import * as k8s from '@kubernetes/client-node';
import { loadKubeConfig } from './config.js';
import { getClusterKubeconfig } from '../clusters/repository.js';
import { hasLocalKubeconfigContext, loadLocalKubeConfig } from '../clusters/local-kubeconfig.js';

// Store the base default config separately to avoid reloading it constantly.
// Cache scope: process-local base in-cluster config; cleared during graceful shutdown.
let baseConfig: k8s.KubeConfig | null = null;

// Request cache scope: per-request only, success-only, naturally discarded at request end.
export type ReqCache = Map<string, Promise<k8s.KubeConfig>>;

function cloneKubeConfig(config: k8s.KubeConfig): k8s.KubeConfig {
	const clone = new k8s.KubeConfig();
	clone.loadFromString(config.exportConfig());
	return clone;
}

function loadInClusterKubeConfig(): k8s.KubeConfig {
	if (!baseConfig) {
		baseConfig = loadKubeConfig();
	}

	return cloneKubeConfig(baseConfig);
}

function loadLocalContextKubeConfig(contextName: string): k8s.KubeConfig {
	const localConfig = loadLocalKubeConfig();
	if (!localConfig) {
		throw new Error(`Local kubeconfig context "${contextName}" is not available`);
	}

	localConfig.setCurrentContext(contextName);
	const config = cloneKubeConfig(localConfig);
	config.setCurrentContext(contextName);
	logger.debug(`✓ Loaded local Kubernetes configuration for context: ${contextName}`);
	return config;
}

async function loadStoredClusterKubeConfig(clusterId: string): Promise<k8s.KubeConfig> {
	const kubeconfigYaml = await getClusterKubeconfig(clusterId);
	if (!kubeconfigYaml) {
		throw new Error(`Cluster with ID "${clusterId}" not found or has no valid configuration`);
	}

	const config = new k8s.KubeConfig();
	config.loadFromString(kubeconfigYaml);
	logger.debug(`✓ Loaded Kubernetes configuration from database for cluster: ${clusterId}`);
	return config;
}

async function loadConfigForCluster(clusterId: string): Promise<k8s.KubeConfig> {
	if (clusterId === IN_CLUSTER_ID) {
		return loadInClusterKubeConfig();
	}

	if (hasLocalKubeconfigContext(clusterId)) {
		return loadLocalContextKubeConfig(clusterId);
	}

	return loadStoredClusterKubeConfig(clusterId);
}

function cacheConfigLoad(
	key: string,
	reqCache: ReqCache,
	load: () => Promise<k8s.KubeConfig>
): Promise<k8s.KubeConfig> {
	const cachedPromise = load()
		.then((config) => {
			reqCache.set(key, Promise.resolve(config));
			return config;
		})
		.catch((error) => {
			reqCache.delete(key);
			throw error;
		});

	reqCache.set(key, cachedPromise);
	return cachedPromise;
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
	const cachedPromise = reqCache?.get(key);
	if (cachedPromise) {
		// Verify the cached promise hasn't rejected
		// Note: We return the promise as-is; if it rejected, caller will handle the rejection
		return cachedPromise;
	}

	if (reqCache) {
		return cacheConfigLoad(key, reqCache, () => loadConfigForCluster(key));
	}

	return loadConfigForCluster(key);
}

export function clearBaseKubeConfig(): void {
	baseConfig = null;
}
