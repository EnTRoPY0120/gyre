import { getResourceDef, type FluxResourceType } from './resources.js';
import type { FluxResource } from './types.js';
import { getCustomObjectsApi } from '../client-pool.js';
import type { ReqCache } from '../kubeconfig-provider.js';
import { handleK8sError } from '../error-handler.js';
import { OPERATION_TIMEOUTS } from '../timeouts.js';

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
