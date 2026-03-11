import type { PageServerLoad } from './$types';
import {
	getAuditLogsPaginated,
	type AuditLogSortBy,
	type AuditLogSortOrder
} from '$lib/server/audit';

export const load: PageServerLoad = async ({ url }) => {
	const rawLimit = url.searchParams.get('limit');
	const rawOffset = url.searchParams.get('offset');
	const rawSortBy = url.searchParams.get('sortBy');
	const rawSortOrder = url.searchParams.get('sortOrder');
	const rawSuccess = url.searchParams.get('success');

	const limitParam = parseInt(rawLimit ?? '', 10);
	const offsetParam = parseInt(rawOffset ?? '', 10);
	const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50;
	const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

	const validSortBy: AuditLogSortBy[] = ['date', 'action'];
	const sortBy: AuditLogSortBy = validSortBy.includes(rawSortBy as AuditLogSortBy)
		? (rawSortBy as AuditLogSortBy)
		: 'date';

	const validSortOrder: AuditLogSortOrder[] = ['asc', 'desc'];
	const sortOrder: AuditLogSortOrder = validSortOrder.includes(rawSortOrder as AuditLogSortOrder)
		? (rawSortOrder as AuditLogSortOrder)
		: 'desc';

	const successFilter = rawSuccess === 'true' ? 'true' : rawSuccess === 'false' ? 'false' : 'all';
	const success: boolean | undefined =
		successFilter === 'true' ? true : successFilter === 'false' ? false : undefined;

	const action = url.searchParams.get('action') || undefined;
	const userId = url.searchParams.get('userId') || undefined;

	const { logs: rawLogs, total } = await getAuditLogsPaginated({
		userId,
		action,
		success,
		limit,
		offset,
		sortBy,
		sortOrder
	});

	const lastValidOffset = total > 0 ? Math.floor((total - 1) / limit) * limit : 0;
	let effectiveOffset = offset;
	let logs = rawLogs;
	if (offset > lastValidOffset) {
		effectiveOffset = lastValidOffset;
		const clamped = await getAuditLogsPaginated({
			userId,
			action,
			success,
			limit,
			offset: effectiveOffset,
			sortBy,
			sortOrder
		});
		logs = clamped.logs;
	}

	return {
		logs: logs.map((log) => {
			let details = null;
			if (log.details) {
				try {
					details = JSON.parse(log.details);
				} catch (e) {
					console.warn(`Failed to parse audit log details for ID ${log.id}:`, e);
					details = { raw: log.details, error: 'Failed to parse JSON' };
				}
			}

			return {
				...log,
				details
			};
		}),
		total,
		limit,
		offset: effectiveOffset,
		sortBy,
		sortOrder,
		successFilter
	};
};
