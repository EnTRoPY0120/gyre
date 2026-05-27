type AdminPaginationDefaults = {
	search?: string;
	limit?: number;
	offset?: number;
};

const DEFAULT_LIMIT = 10;
const DEFAULT_OFFSET = 0;
const MAX_LIMIT = 100;

export function parseAdminPagination(url: URL, defaults: AdminPaginationDefaults = {}) {
	const defaultSearch = defaults.search ?? '';
	const defaultLimit = defaults.limit ?? DEFAULT_LIMIT;
	const defaultOffset = defaults.offset ?? DEFAULT_OFFSET;

	const search = url.searchParams.get('search') || defaultSearch;
	const limitParam = parseInt(url.searchParams.get('limit') || String(defaultLimit));
	const offsetParam = parseInt(url.searchParams.get('offset') || String(defaultOffset));
	const limit =
		Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_LIMIT) : defaultLimit;
	const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : defaultOffset;

	return { search, limit, offset };
}
