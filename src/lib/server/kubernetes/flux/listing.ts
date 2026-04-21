import { logger } from '../../logger.js';
import { getResourceDef, type FluxResourceType } from './resources.js';
import type { FluxResource, FluxResourceList } from './types.js';
import { getCustomObjectsApi } from '../client-pool.js';
import type { ReqCache } from '../kubeconfig-provider.js';
import { handleK8sError } from '../error-handler.js';

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
