import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAllResourceTypes, getResourceInfo } from '$lib/config/resources';
import type { FluxResource } from '$lib/types/flux';

const VALID_SORT_BY = ['name', 'age', 'status'] as const;
const VALID_SORT_ORDER = ['asc', 'desc'] as const;

type SortBy = (typeof VALID_SORT_BY)[number];
type SortOrder = (typeof VALID_SORT_ORDER)[number];

export const load: PageServerLoad = async ({ params, url, fetch, depends }) => {
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
	const sortBy: SortBy | undefined = VALID_SORT_BY.includes(rawSortBy as SortBy)
		? (rawSortBy as SortBy)
		: undefined;
	const sortOrder: SortOrder = VALID_SORT_ORDER.includes(rawSortOrder as SortOrder)
		? (rawSortOrder as SortOrder)
		: 'asc';

	// Build API URL with pagination/sort params
	const apiUrl = new URL(`/api/flux/${type}`, url.origin);
	if (sortBy) {
		apiUrl.searchParams.set('sortBy', sortBy);
		apiUrl.searchParams.set('sortOrder', sortOrder);
	}

	try {
		const response = await fetch(apiUrl.toString());

		if (!response.ok) {
			if (response.status === 404) {
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
			const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
			return {
				resourceType: type,
				resourceInfo,
				resources: [] as FluxResource[],
				total: 0,
				sortBy,
				sortOrder,
				error: errorData.error || `Failed to fetch resources: ${response.status}`
			};
		}

		const data = await response.json();
		const resources: FluxResource[] = data.items || [];

		return {
			resourceType: type,
			resourceInfo,
			resources,
			total: data.total ?? resources.length,
			sortBy,
			sortOrder,
			error: null
		};
	} catch (err) {
		console.error(`Error fetching ${type}:`, err);
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
