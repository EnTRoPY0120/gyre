import { logger } from '$lib/server/logger.js';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAllResourceTypes, getResourceInfo } from '$lib/config/resources';
import type { FluxResource } from '$lib/types/flux';
import { fetchWithRetry } from '$lib/utils/fetch';

export const load: PageServerLoad = async ({ params, fetch: svelteFetch, depends }) => {
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
		const response = await fetchWithRetry(`/api/flux/${type}/${namespace}/${name}`, undefined, {
			fetchFn: svelteFetch,
			maxRetries: 0,
			logger
		});

		if (!response.ok) {
			if (response.status === 404) {
				error(404, {
					message: `Resource not found: ${namespace}/${name}`
				});
			}
			const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
			error(response.status, {
				message:
					errorData.message || errorData.error || `Failed to fetch resource: ${response.status}`
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
		logger.error(err, `Error fetching ${type}/${namespace}/${name}:`);
		error(500, {
			message: 'Failed to connect to the API'
		});
	}
};
