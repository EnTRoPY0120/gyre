import * as k8s from '@kubernetes/client-node';
import { loadKubeConfig } from './config.js';
import { getClusterKubeconfig } from '../clusters.js';
import {
	getResourceDef,
	getResourceTypeByPlural,
	type FluxResourceType
} from './flux/resources.js';
import type { FluxResource, FluxResourceList } from './flux/types.js';

// Cache for Kubernetes configurations to ensure atomic access and performance
// Maps clusterId or contextName to a fully configured KubeConfig instance
const configCache = new Map<string, k8s.KubeConfig>();

// Store the base default config separately to avoid reloading it constantly
let baseConfig: k8s.KubeConfig | null = null;

/**
 * Get or create KubeConfig for a specific cluster or context
 * This function is now asynchronous and atomic per-request.
 * @param clusterIdOrContext - Optional cluster ID (UUID) or context name
 */
export async function getKubeConfig(clusterIdOrContext?: string): Promise<k8s.KubeConfig> {
	const key = clusterIdOrContext || 'in-cluster';

	// 1. Check cache first
	if (configCache.has(key)) {
		return configCache.get(key)!;
	}

	// 2. Load the base configuration if not already loaded
	if (!baseConfig) {
		baseConfig = loadKubeConfig();
	}

	let config: k8s.KubeConfig;

	// 3. Determine if it's a cluster ID (UUID), a context name, or default
	const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);

	if (isUuid) {
		// Load from database
		const kubeconfigYaml = await getClusterKubeconfig(key);
		if (!kubeconfigYaml) {
			throw new Error(`Cluster with ID "${key}" not found or has no valid configuration`);
		}
		config = new k8s.KubeConfig();
		config.loadFromString(kubeconfigYaml);
		console.log(`✓ Loaded Kubernetes configuration from database for cluster: ${key}`);
	} else if (key !== 'in-cluster' && key !== 'default') {
		// It's a context name - check if it exists in the base config
		const availableContexts = baseConfig.getContexts().map((c) => c.name);
		if (availableContexts.includes(key)) {
			// Create a clone of the base config and switch context
			config = new k8s.KubeConfig();
			config.loadFromString(baseConfig.exportConfig());
			config.setCurrentContext(key);
			console.log(`✓ Switched to Kubernetes context: ${key}`);
		} else {
			console.warn(`Context "${key}" not found. Falling back to default.`);
			config = baseConfig;
		}
	} else {
		// Default context
		config = baseConfig;
	}

	// 4. Cache and return
	configCache.set(key, config);
	return config;
}

/**
 * Create CustomObjectsApi client
 * @param context - Optional cluster ID or context name
 */
export async function getCustomObjectsApi(context?: string): Promise<k8s.CustomObjectsApi> {
	const config = await getKubeConfig(context);
	return config.makeApiClient(k8s.CustomObjectsApi);
}

/**
 * Create CoreV1Api client
 * @param context - Optional cluster ID or context name
 */
export async function getCoreV1Api(context?: string): Promise<k8s.CoreV1Api> {
	const config = await getKubeConfig(context);
	return config.makeApiClient(k8s.CoreV1Api);
}

/**
 * Create AppsV1Api client
 * @param context - Optional cluster ID or context name
 */
export async function getAppsV1Api(context?: string): Promise<k8s.AppsV1Api> {
	const config = await getKubeConfig(context);
	return config.makeApiClient(k8s.AppsV1Api);
}

// Cache for Kubernetes resources
const resourceCache = new Map<
	string,
	{ data: FluxResource | FluxResourceList; timestamp: number }
>();
const pendingRequests = new Map<string, Promise<FluxResource | FluxResourceList>>();
const CACHE_TTL = 5000; // 5 seconds cache for K8s resources

/**
 * List FluxCD resources of a specific type across all namespaces
 */
export async function listFluxResources(
	resourceType: FluxResourceType,
	context?: string
): Promise<FluxResourceList> {
	const cacheKey = `list:${resourceType}:${context || 'default'}`;

	// Check cache
	const cached = resourceCache.get(cacheKey);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.data as FluxResourceList;
	}

	// Check pending requests (deduplication)
	if (pendingRequests.has(cacheKey)) {
		return pendingRequests.get(cacheKey) as Promise<FluxResourceList>;
	}

	const resourceDef = getResourceDef(resourceType);
	if (!resourceDef) {
		throw new Error(`Unknown resource type: ${resourceType}`);
	}

	const api = await getCustomObjectsApi(context);

	const fetchPromise = (async () => {
		try {
			const response = await api.listClusterCustomObject({
				group: resourceDef.group,
				version: resourceDef.version,
				plural: resourceDef.plural
			});

			const data = response as unknown as FluxResourceList;
			resourceCache.set(cacheKey, { data, timestamp: Date.now() });
			return data;
		} catch (error) {
			throw handleK8sError(error, `list ${resourceType}`);
		} finally {
			pendingRequests.delete(cacheKey);
		}
	})();

	pendingRequests.set(cacheKey, fetchPromise);
	return fetchPromise;
}

/**
 * List FluxCD resources of a specific type in a namespace
 */
export async function listFluxResourcesInNamespace(
	resourceType: FluxResourceType,
	namespace: string,
	context?: string
): Promise<FluxResourceList> {
	const cacheKey = `list:${resourceType}:${namespace}:${context || 'default'}`;

	const cached = resourceCache.get(cacheKey);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.data as FluxResourceList;
	}

	if (pendingRequests.has(cacheKey)) {
		return pendingRequests.get(cacheKey) as Promise<FluxResourceList>;
	}

	const resourceDef = getResourceDef(resourceType);
	if (!resourceDef) {
		throw new Error(`Unknown resource type: ${resourceType}`);
	}

	const api = await getCustomObjectsApi(context);

	const fetchPromise = (async () => {
		try {
			const response = await api.listNamespacedCustomObject({
				group: resourceDef.group,
				version: resourceDef.version,
				namespace,
				plural: resourceDef.plural
			});

			const data = response as unknown as FluxResourceList;
			resourceCache.set(cacheKey, { data, timestamp: Date.now() });
			return data;
		} catch (error) {
			throw handleK8sError(error, `list ${resourceType} in namespace ${namespace}`);
		} finally {
			pendingRequests.delete(cacheKey);
		}
	})();

	pendingRequests.set(cacheKey, fetchPromise);
	return fetchPromise;
}

/**
 * Get a specific FluxCD resource
 */
export async function getFluxResource(
	resourceType: FluxResourceType,
	namespace: string,
	name: string,
	context?: string
): Promise<FluxResource> {
	const cacheKey = `get:${resourceType}:${namespace}:${name}:${context || 'default'}`;

	const cached = resourceCache.get(cacheKey);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.data as FluxResource;
	}

	if (pendingRequests.has(cacheKey)) {
		return pendingRequests.get(cacheKey) as Promise<FluxResource>;
	}

	const resourceDef = getResourceDef(resourceType);
	if (!resourceDef) {
		throw new Error(`Unknown resource type: ${resourceType}`);
	}

	const api = await getCustomObjectsApi(context);

	const fetchPromise = (async () => {
		try {
			const response = await api.getNamespacedCustomObject({
				group: resourceDef.group,
				version: resourceDef.version,
				namespace,
				plural: resourceDef.plural,
				name
			});

			const data = response as unknown as FluxResource;
			resourceCache.set(cacheKey, { data, timestamp: Date.now() });
			return data;
		} catch (error) {
			throw handleK8sError(error, `get ${resourceType} ${namespace}/${name}`);
		} finally {
			pendingRequests.delete(cacheKey);
		}
	})();

	pendingRequests.set(cacheKey, fetchPromise);
	return fetchPromise;
}

/**
 * Get resource status (uses getNamespacedCustomObjectStatus)
 */
export async function getFluxResourceStatus(
	resourceType: FluxResourceType,
	namespace: string,
	name: string,
	context?: string
): Promise<FluxResource> {
	const resourceDef = getResourceDef(resourceType);
	if (!resourceDef) {
		throw new Error(`Unknown resource type: ${resourceType}`);
	}

	const api = await getCustomObjectsApi(context);

	try {
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
 * Get a generic Kubernetes resource (Core/Apps)
 */
export async function getGenericResource(
	group: string,
	kind: string,
	namespace: string,
	name: string,
	context?: string
): Promise<unknown> {
	// Normalize group for core resources (often empty or "core")
	const normalizedGroup = group === 'core' || group === '' ? '' : group;

	try {
		if (normalizedGroup === '') {
			const coreApi = await getCoreV1Api(context);
			// Mapped types
			switch (kind) {
				case 'Service':
					return await coreApi.readNamespacedService({ name, namespace });
				case 'Pod':
					return await coreApi.readNamespacedPod({ name, namespace });
				case 'ConfigMap':
					return await coreApi.readNamespacedConfigMap({ name, namespace });
				case 'Secret':
					return await coreApi.readNamespacedSecret({ name, namespace });
				case 'ServiceAccount':
					return await coreApi.readNamespacedServiceAccount({ name, namespace });
				default:
					// Fallback for others? We might need CustomObjects if it's not a known Core type?
					// But we don't know the plural.
					return {
						apiVersion: 'v1',
						kind,
						metadata: { name, namespace, error: 'Unsupported Core Kind' }
					};
			}
		} else if (normalizedGroup === 'apps') {
			const appsApi = await getAppsV1Api(context);
			switch (kind) {
				case 'Deployment':
					return await appsApi.readNamespacedDeployment({ name, namespace });
				case 'StatefulSet':
					return await appsApi.readNamespacedStatefulSet({ name, namespace });
				case 'DaemonSet':
					return await appsApi.readNamespacedDaemonSet({ name, namespace });
				case 'ReplicaSet':
					return await appsApi.readNamespacedReplicaSet({ name, namespace });
				default:
					return {
						apiVersion: 'apps/v1',
						kind,
						metadata: { name, namespace, error: 'Unsupported Apps Kind' }
					};
			}
		}

		// Everything else: Try CustomObjects, guessing plural = lowercase(kind) + 's'
		// This is heuristic and fragile but covers many cases (Gateways, SealedSecrets, etc)
		// Need version... Flux inventory doesn't always have it. We can try 'v1' or 'v1beta1' or wildcard?
		// Without version, CustomObjectsApi calls fail.
		// For now, return a placeholder.
		return {
			apiVersion: `${group}/?`,
			kind,
			metadata: { name, namespace },
			status: {
				conditions: [
					{ type: 'Ready', status: 'Unknown', message: 'Generic Group fetch not yet implemented' }
				]
			}
		};
	} catch (error) {
		// Verify if it is a 404 - return null or a specific error object
		return {
			apiVersion: group ? `${group}/?` : 'v1',
			kind,
			metadata: { name, namespace },
			status: {
				conditions: [
					{ type: 'Ready', status: 'Unknown', message: `Fetch failed: ${(error as Error).message}` }
				]
			}
		};
	}
}

/**
 * Create a FluxCD resource
 */
export async function createFluxResource(
	resourceType: string,
	namespace: string,
	body: Record<string, unknown>,
	context?: string
): Promise<FluxResource> {
	const resourceDef = getResourceDef(resourceType);
	if (!resourceDef) {
		throw new Error(`Unknown resource type: ${resourceType}`);
	}

	const api = await getCustomObjectsApi(context);

	try {
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
 * Get logs for a FluxCD controller responsible for a specific resource
 */
export async function getControllerLogs(
	resourceType: string,
	namespace: string,
	name: string,
	context?: string
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
	const coreApi = await getCoreV1Api(context);

	try {
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
		throw handleK8sError(error, `fetch logs for ${controllerName}`);
	}
}

/**
 * Handle Kubernetes API errors
 */
function handleK8sError(error: unknown, operation: string): Error {
	if (error instanceof Error) {
		const k8sError = error as Error & {
			response?: { statusCode: number; body?: { message?: string } };
		};
		if (k8sError.response) {
			const status = k8sError.response.statusCode;
			const message = k8sError.response.body?.message || error.message;

			switch (status) {
				case 404:
					return new Error(`Resource not found: ${operation}`);
				case 401:
					return new Error(`Authentication failed: ${operation}`);
				case 403:
					return new Error(`Permission denied: ${operation}`);
				default:
					return new Error(`Kubernetes API error (${status}): ${message}`);
			}
		}
		return new Error(`Failed to ${operation}: ${error.message}`);
	}
	return new Error(`Failed to ${operation}: Unknown error`);
}
