import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAllResourceTypes, getResourceInfo } from '$lib/config/resources';
import type { FluxResource } from '$lib/types/flux';

export const load: PageServerLoad = async ({ params, fetch }) => {
	const { type, namespace, name } = params;

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

		return {
			resourceType: type,
			resourceInfo,
			namespace,
			name,
			resource
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
