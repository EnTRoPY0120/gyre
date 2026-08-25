import { logger } from '$lib/server/logger.js';
import type { AuditLogSortBy, AuditLogSortOrder } from '$lib/server/audit';

export interface AuditLogPageQuery {
	userId?: string;
	action?: string;
	success: boolean | undefined;
	limit: number;
	offset: number;
	sortBy: AuditLogSortBy;
	sortOrder: AuditLogSortOrder;
	successFilter: string;
}

const SORT_BY_VALUES: AuditLogSortBy[] = ['date', 'action'];
const SORT_ORDER_VALUES: AuditLogSortOrder[] = ['asc', 'desc'];

function parsePagination(url: URL): Pick<AuditLogPageQuery, 'limit' | 'offset'> {
	const limitParam = parseInt(url.searchParams.get('limit') ?? '', 10);
	const offsetParam = parseInt(url.searchParams.get('offset') ?? '', 10);
	return {
		limit: Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50,
		offset: Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : 0
	};
}

function parseSort(url: URL): Pick<AuditLogPageQuery, 'sortBy' | 'sortOrder'> {
	const rawSortBy = url.searchParams.get('sortBy');
	const rawSortOrder = url.searchParams.get('sortOrder');
	return {
		sortBy: SORT_BY_VALUES.includes(rawSortBy as AuditLogSortBy)
			? (rawSortBy as AuditLogSortBy)
			: 'date',
		sortOrder: SORT_ORDER_VALUES.includes(rawSortOrder as AuditLogSortOrder)
			? (rawSortOrder as AuditLogSortOrder)
			: 'desc'
	};
}

function parseSuccessFilter(url: URL): Pick<AuditLogPageQuery, 'success' | 'successFilter'> {
	const rawSuccess = url.searchParams.get('success');
	if (rawSuccess === 'true') return { success: true, successFilter: 'true' };
	if (rawSuccess === 'false') return { success: false, successFilter: 'false' };
	return { success: undefined, successFilter: 'all' };
}

/** Normalize URL query parameters into the audit repository's pagination contract. */
export function parseAuditLogPageQuery(url: URL): AuditLogPageQuery {
	const pagination = parsePagination(url);
	const sort = parseSort(url);
	const success = parseSuccessFilter(url);

	return {
		userId: url.searchParams.get('userId') || undefined,
		action: url.searchParams.get('action') || undefined,
		...success,
		...pagination,
		...sort
	};
}

/** Parse persisted details while retaining malformed records for administrators. */
export function parseAuditLogDetails(details: string | null, id: string): unknown {
	if (!details) return null;
	try {
		return JSON.parse(details);
	} catch (error) {
		logger.warn(error, `Failed to parse audit log details for ID ${id}:`);
		return { raw: details, error: 'Failed to parse JSON' };
	}
}
