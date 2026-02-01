import * as k8s from '@kubernetes/client-node';
import { loadKubeConfig, type KubeConfigResult } from './config.js';
import { getResourceDef, type FluxResourceType } from './flux/resources.js';
import type { FluxResource, FluxResourceList } from './flux/types.js';

let cachedConfig: KubeConfigResult | null = null;

/**
 * Get or create cached KubeConfig
 */
export function getKubeConfig(): KubeConfigResult {
	if (!cachedConfig) {
		cachedConfig = loadKubeConfig();
	}
	return cachedConfig;
}

/**
 * Create CustomObjectsApi client
 */
export function getCustomObjectsApi(): k8s.CustomObjectsApi {
	const { config } = getKubeConfig();
	return config.makeApiClient(k8s.CustomObjectsApi);
}

/**
 * List FluxCD resources of a specific type across all namespaces
 */
export async function listFluxResources(resourceType: FluxResourceType): Promise<FluxResourceList> {
	const resourceDef = getResourceDef(resourceType);
	if (!resourceDef) {
		throw new Error(`Unknown resource type: ${resourceType}`);
	}

	const api = getCustomObjectsApi();

	try {
		const response = await api.listClusterCustomObject({
			group: resourceDef.group,
			version: resourceDef.version,
			plural: resourceDef.plural
		});

		// The Kubernetes API returns the data directly, not wrapped in { body: ... }
		return response as unknown as FluxResourceList;
	} catch (error) {
		throw handleK8sError(error, `list ${resourceType}`);
	}
}

/**
 * List FluxCD resources of a specific type in a namespace
 */
export async function listFluxResourcesInNamespace(
	resourceType: FluxResourceType,
	namespace: string
): Promise<FluxResourceList> {
	const resourceDef = getResourceDef(resourceType);
	if (!resourceDef) {
		throw new Error(`Unknown resource type: ${resourceType}`);
	}

	const api = getCustomObjectsApi();

	try {
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
 * Get a specific FluxCD resource
 */
export async function getFluxResource(
	resourceType: FluxResourceType,
	namespace: string,
	name: string
): Promise<FluxResource> {
	const resourceDef = getResourceDef(resourceType);
	if (!resourceDef) {
		throw new Error(`Unknown resource type: ${resourceType}`);
	}

	const api = getCustomObjectsApi();

	try {
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
	name: string
): Promise<FluxResource> {
	const resourceDef = getResourceDef(resourceType);
	if (!resourceDef) {
		throw new Error(`Unknown resource type: ${resourceType}`);
	}

	const api = getCustomObjectsApi();

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
