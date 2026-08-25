import { getResourceDef, type FluxResourceType } from './resources.js';
import type { FluxResource, FluxResourceList } from './types.js';
import { getCustomObjectsApi } from '../client-pool.js';
import type { ReqCache } from '../kubeconfig-provider.js';
import { handleK8sError } from '../error-handler.js';
import { paginateResources, shouldUseNativePaging, type ListOptions } from './listing-helpers.js';
export type { ListOptions } from './listing-helpers.js';

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
		const nativeLimit = options?.limit;
		const useNativePaging = shouldUseNativePaging(options);

		const response = await api.listClusterCustomObject({
			group: resourceDef.group,
			version: resourceDef.version,
			plural: resourceDef.plural,
			...(useNativePaging && nativeLimit !== undefined ? { limit: nativeLimit } : {})
		});

		const list = response as unknown as FluxResourceList;
		const items = list.items ?? [];

		if (useNativePaging && nativeLimit !== undefined) {
			// k8s already returned the page; metadata.continue signals more pages.
			return {
				items,
				total: null, // exact total unknown with cursor-based k8s paging; use hasMore instead
				hasMore: !!list.metadata?.continue,
				offset: 0,
				limit: nativeLimit,
				metadata: {
					resourceVersion: list.metadata?.resourceVersion,
					continueToken: list.metadata?.continue
				}
			};
		}

		// Full-fetch path: sort (if requested) then slice.
		const page = paginateResources(items, options);

		return {
			...page,
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
