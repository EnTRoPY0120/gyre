import { VALID_SORT_BY, VALID_SORT_ORDER, type SortBy, type SortOrder } from '$lib/config/sorting';

export interface ResourceListQuery {
	limit: number | undefined;
	offset: number | undefined;
	sortBy: SortBy | undefined;
	sortOrder: SortOrder;
}

export function parseResourceListQuery(url: URL): ResourceListQuery {
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

	const limitValue = rawLimit !== null ? Number(rawLimit) : undefined;
	const offsetValue = rawOffset !== null ? Number(rawOffset) : undefined;
	const limit =
		limitValue !== undefined && Number.isInteger(limitValue) && limitValue >= 1 && limitValue <= 500
			? limitValue
			: undefined;
	const offset =
		offsetValue !== undefined && Number.isInteger(offsetValue) && offsetValue >= 0
			? offsetValue
			: undefined;

	return { limit, offset, sortBy, sortOrder };
}

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

/** Convert loader failures into the page's stable, user-facing error string. */
export function getResourceListLoadError(error: unknown): string | null {
	if (!isHttpErrorLike(error)) return 'Failed to connect to the API';
	if (error.status === 404) return null;
	return error.body?.message || error.body?.error || `Failed to fetch resources: ${error.status}`;
}
