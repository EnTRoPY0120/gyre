import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAllResourceTypes, getResourceInfo } from '$lib/config/resources';
import type { FluxResource } from '$lib/types/flux';
import { listFluxResourcesForType } from '$lib/server/flux/services.js';
import { requireClusterWideRead } from '$lib/server/http/guards.js';
import { getResourceListLoadError, parseResourceListQuery } from './resource-list-load.js';

export const load: PageServerLoad = async ({ params, url, locals, depends }) => {
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

	const query = parseResourceListQuery(url);

	try {
		await requireClusterWideRead(locals);
		const { result } = await listFluxResourcesForType({
			locals,
			query,
			resourceType: type
		});
		const resources: FluxResource[] = result.items || [];

		return {
			resourceType: type,
			resourceInfo,
			resources,
			total: result.total,
			...query,
			error: null
		};
	} catch (err) {
		return {
			resourceType: type,
			resourceInfo,
			resources: [] as FluxResource[],
			total: 0,
			...query,
			error: getResourceListLoadError(err)
		};
	}
};
