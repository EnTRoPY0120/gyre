import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAllResourceTypes, getResourceInfo } from '$lib/config/resources';
import type { FluxResource } from '$lib/types/flux';
import { parseInventory, type InventoryResource } from '$lib/server/kubernetes/flux/inventory';
import { getGenericResource } from '$lib/server/kubernetes/client';

export const load: PageServerLoad = async ({ params, fetch, depends, locals }) => {
	const { type, namespace, name } = params;
	depends(`flux:resource:${type}:${namespace}:${name}`);

	// Validate resource type
	const validTypes = getAllResourceTypes();
	if (!validTypes.includes(type)) {
		error(404, {
			message: `Unknown resource type: ${type}`
		});
	}

	const resourceInfo = getResourceInfo(type);
	if (!resourceInfo) {
		error(404, {
			message: `Resource info not found for: ${type}`
		});
	}

	try {
		const response = await fetch(`/api/flux/${type}/${namespace}/${name}`);

		if (!response.ok) {
			if (response.status === 404) {
				error(404, {
					message: `Resource not found: ${namespace}/${name}`
				});
			}
			const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
			error(response.status, {
				message: errorData.error || `Failed to fetch resource: ${response.status}`
			});
		}

		const resource: FluxResource = await response.json();
		let inventoryResources: any[] = [];

		if (resource.status?.inventory?.entries) {
			try {
				const parsed = parseInventory(resource.status.inventory.entries);
				// Fetch first 50 resources to avoid overload
				// We filter out CRDs for now as our getGenericResource is limited
				const targetResources = parsed.slice(0, 50);

				inventoryResources = await Promise.all(
					targetResources.map(async (r) => {
						try {
							const child = await getGenericResource(
								r.group,
								r.kind,
								r.namespace,
								r.name,
								locals.cluster
							);
							// Add our internal inventory version/id metadata back
							return { ...child, _inventory: r };
						} catch (e) {
							return {
								_inventory: r,
								kind: r.kind,
								metadata: { name: r.name, namespace: r.namespace },
								error: 'Failed to fetch'
							};
						}
					})
				);
			} catch (e) {
				console.error('Error parsing/fetching inventory:', e);
			}
		}

		return {
			resourceType: type,
			resourceInfo,
			namespace,
			name,
			resource,
			inventoryResources
		};
	} catch (err) {
		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		console.error(`Error fetching ${type}/${namespace}/${name}:`, err);
		error(500, {
			message: 'Failed to connect to the API'
		});
	}
};
