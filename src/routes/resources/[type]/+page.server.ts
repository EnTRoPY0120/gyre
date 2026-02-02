import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAllResourceTypes, getResourceInfo } from '$lib/config/resources';
import type { FluxResource } from '$lib/types/flux';

export const load: PageServerLoad = async ({ params, fetch, depends }) => {
	const { type } = params;
	depends(`flux:${type}`); // e.g. flux:gitrepositories

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
		const response = await fetch(`/api/flux/${type}`);

		if (!response.ok) {
			if (response.status === 404) {
				// No resources found - return empty list
				return {
					resourceType: type,
					resourceInfo,
					resources: [] as FluxResource[],
					error: null
				};
			}
			const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
			return {
				resourceType: type,
				resourceInfo,
				resources: [] as FluxResource[],
				error: errorData.error || `Failed to fetch resources: ${response.status}`
			};
		}

		const data = await response.json();
		const resources: FluxResource[] = data.items || [];

		return {
			resourceType: type,
			resourceInfo,
			resources,
			error: null
		};
	} catch (err) {
		console.error(`Error fetching ${type}:`, err);
		return {
			resourceType: type,
			resourceInfo,
			resources: [] as FluxResource[],
			error: 'Failed to connect to the API'
		};
	}
};
