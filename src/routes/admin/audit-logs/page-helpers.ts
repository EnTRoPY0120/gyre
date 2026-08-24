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

/** Normalize URL query parameters into the audit repository's pagination contract. */
export function parseAuditLogPageQuery(url: URL): AuditLogPageQuery {
	const limitParam = parseInt(url.searchParams.get('limit') ?? '', 10);
	const offsetParam = parseInt(url.searchParams.get('offset') ?? '', 10);
	const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50;
	const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

	const rawSortBy = url.searchParams.get('sortBy');
	const rawSortOrder = url.searchParams.get('sortOrder');
	const sortBy = SORT_BY_VALUES.includes(rawSortBy as AuditLogSortBy)
		? (rawSortBy as AuditLogSortBy)
		: 'date';
	const sortOrder = SORT_ORDER_VALUES.includes(rawSortOrder as AuditLogSortOrder)
		? (rawSortOrder as AuditLogSortOrder)
		: 'desc';

	const rawSuccess = url.searchParams.get('success');
	const successFilter = rawSuccess === 'true' ? 'true' : rawSuccess === 'false' ? 'false' : 'all';
	const success = successFilter === 'true' ? true : successFilter === 'false' ? false : undefined;

	return {
		userId: url.searchParams.get('userId') || undefined,
		action: url.searchParams.get('action') || undefined,
		success,
		limit,
		offset,
		sortBy,
		sortOrder,
		successFilter
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
