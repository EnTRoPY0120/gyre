import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAllResourceTypes, getResourceInfo } from '$lib/config/resources';
import { VALID_SORT_BY, VALID_SORT_ORDER, type SortBy, type SortOrder } from '$lib/config/sorting';
import type { FluxResource } from '$lib/types/flux';
import { listFluxResourcesForType } from '$lib/server/flux/services.js';
import { requireClusterWideRead } from '$lib/server/http/guards.js';

function isHttpErrorLike(error: unknown): error is {
	body?: { error?: string; message?: string };
	status: number;
} {
	return (
		typeof error === 'object' &&
		error !== null &&
		'status' in error &&
		typeof (error as { status: unknown }).status === 'number'
	);
}

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

	// Parse sort/pagination params from URL
	const rawSortBy = url.searchParams.get('sortBy');
	const rawSortOrder = url.searchParams.get('sortOrder');
	const rawLimit = url.searchParams.get('limit');
	const rawOffset = url.searchParams.get('offset');

	const sortBy: SortBy | undefined = VALID_SORT_BY.includes(rawSortBy as SortBy)
		? (rawSortBy as SortBy)
		: undefined;
	const sortOrder: SortOrder = VALID_SORT_ORDER.includes(rawSortOrder as SortOrder)
		? (rawSortOrder as SortOrder)
		: 'asc';

	const limitNum = rawLimit !== null ? Number(rawLimit) : undefined;
	const offsetNum = rawOffset !== null ? Number(rawOffset) : undefined;
	// Mirror the API schema: limit must be an integer 1–500, offset must be a non-negative integer.
	const limit =
		limitNum !== undefined && Number.isInteger(limitNum) && limitNum >= 1 && limitNum <= 500
			? limitNum
			: undefined;
	const offset =
		offsetNum !== undefined && Number.isInteger(offsetNum) && offsetNum >= 0
			? offsetNum
			: undefined;

	try {
		await requireClusterWideRead(locals);
		const { result } = await listFluxResourcesForType({
			locals,
			query: {
				limit,
				offset,
				sortBy,
				sortOrder
			},
			resourceType: type
		});
		const resources: FluxResource[] = result.items || [];

		return {
			resourceType: type,
			resourceInfo,
			resources,
			total: result.total,
			sortBy,
			sortOrder,
			error: null
		};
	} catch (err) {
		if (isHttpErrorLike(err)) {
			if (err.status === 404) {
				return {
					resourceType: type,
					resourceInfo,
					resources: [] as FluxResource[],
					total: 0,
					sortBy,
					sortOrder,
					error: null
				};
			}

			return {
				resourceType: type,
				resourceInfo,
				resources: [] as FluxResource[],
				total: 0,
				sortBy,
				sortOrder,
				error: err.body?.message || err.body?.error || `Failed to fetch resources: ${err.status}`
			};
		}

		return {
			resourceType: type,
			resourceInfo,
			resources: [] as FluxResource[],
			total: 0,
			sortBy,
			sortOrder,
			error: 'Failed to connect to the API'
		};
	}
};
