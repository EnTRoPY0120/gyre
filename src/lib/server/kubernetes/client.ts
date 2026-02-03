import * as k8s from '@kubernetes/client-node';
import { loadKubeConfig, type KubeConfigResult } from './config.js';
import { getResourceDef, type FluxResourceType } from './flux/resources.js';
import type { FluxResource, FluxResourceList } from './flux/types.js';

// Cache for different contexts
let configCache: Record<string, KubeConfigResult> = {};

/**
 * Get or create cached KubeConfig for a specific context
 */
export function getKubeConfig(context?: string): KubeConfigResult {
	const cacheKey = context || 'default';
	if (!configCache[cacheKey]) {
		configCache[cacheKey] = loadKubeConfig(context);
	}
	return configCache[cacheKey];
}

/**
 * Create CustomObjectsApi client for a specific context
 */
export function getCustomObjectsApi(context?: string): k8s.CustomObjectsApi {
	const { config } = getKubeConfig(context);
	return config.makeApiClient(k8s.CustomObjectsApi);
}

/**
 * Create CoreV1Api client
 */
export function getCoreV1Api(context?: string): k8s.CoreV1Api {
	const { config } = getKubeConfig(context);
	return config.makeApiClient(k8s.CoreV1Api);
}

/**
 * Create AppsV1Api client
 */
export function getAppsV1Api(context?: string): k8s.AppsV1Api {
	const { config } = getKubeConfig(context);
	return config.makeApiClient(k8s.AppsV1Api);
}

// Cache for Kubernetes resources
const resourceCache = new Map<string, { data: any; timestamp: number }>();
const pendingRequests = new Map<string, Promise<any>>();
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
		return cached.data;
	}

	// Check pending requests (deduplication)
	if (pendingRequests.has(cacheKey)) {
		return pendingRequests.get(cacheKey);
	}

	const resourceDef = getResourceDef(resourceType);
	if (!resourceDef) {
		throw new Error(`Unknown resource type: ${resourceType}`);
	}

	const api = getCustomObjectsApi(context);

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
		return cached.data;
	}

	if (pendingRequests.has(cacheKey)) {
		return pendingRequests.get(cacheKey);
	}

	const resourceDef = getResourceDef(resourceType);
	if (!resourceDef) {
		throw new Error(`Unknown resource type: ${resourceType}`);
	}

	const api = getCustomObjectsApi(context);

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
		return cached.data;
	}

	if (pendingRequests.has(cacheKey)) {
		return pendingRequests.get(cacheKey);
	}

	const resourceDef = getResourceDef(resourceType);
	if (!resourceDef) {
		throw new Error(`Unknown resource type: ${resourceType}`);
	}

	const api = getCustomObjectsApi(context);

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

	const api = getCustomObjectsApi(context);

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
 * Create a new FluxCD resource
 */
export async function createFluxResource(
	resourceType: FluxResourceType,
	namespace: string,
	body: any,
	context?: string
): Promise<FluxResource> {
	const resourceDef = getResourceDef(resourceType);
	if (!resourceDef) {
		throw new Error(`Unknown resource type: ${resourceType}`);
	}

	const api = getCustomObjectsApi(context);

	try {
		const response = await api.createNamespacedCustomObject({
			group: resourceDef.group,
			version: resourceDef.version,
			namespace,
			plural: resourceDef.plural,
			body
		});

		return response as unknown as FluxResource;
	} catch (error) {
		throw handleK8sError(error, `create ${resourceType} in ${namespace}`);
	}
}

/**
 * Update (Patch) an existing FluxCD resource
 */
export async function updateFluxResource(
	resourceType: FluxResourceType,
	namespace: string,
	name: string,
	body: any,
	context?: string
): Promise<FluxResource> {
	const resourceDef = getResourceDef(resourceType);
	if (!resourceDef) {
		throw new Error(`Unknown resource type: ${resourceType}`);
	}

	const api = getCustomObjectsApi(context);

	try {
		const response = await api.patchNamespacedCustomObject({
			group: resourceDef.group,
			version: resourceDef.version,
			namespace,
			plural: resourceDef.plural,
			name,
			body,
			headers: { 'Content-Type': 'application/merge-patch+json' }
		} as any);

		return response as unknown as FluxResource;
	} catch (error) {
		throw handleK8sError(error, `patch ${resourceType} ${namespace}/${name}`);
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
): Promise<any> {
	// Normalize group for core resources (often empty or "core")
	const normalizedGroup = group === 'core' || group === '' ? '' : group;

	try {
		if (normalizedGroup === '') {
			const coreApi = getCoreV1Api(context);
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
			const appsApi = getAppsV1Api(context);
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
		const customApi = getCustomObjectsApi(context);
		const plural = kind.toLowerCase() + 's';
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
