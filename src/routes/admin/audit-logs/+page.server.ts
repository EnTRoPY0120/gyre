import type { PageServerLoad } from './$types';
import { getAuditLogsPaginated } from '$lib/server/audit';
import { parseAuditLogDetails, parseAuditLogPageQuery } from './page-helpers';

export const load: PageServerLoad = async ({ url }) => {
	const query = parseAuditLogPageQuery(url);

	const { logs: rawLogs, total } = await getAuditLogsPaginated({
		...query
	});

	const lastValidOffset = total > 0 ? Math.floor((total - 1) / query.limit) * query.limit : 0;
	let effectiveOffset = query.offset;
	let logs = rawLogs;
	if (query.offset > lastValidOffset) {
		effectiveOffset = lastValidOffset;
		const clamped = await getAuditLogsPaginated({
			...query,
			offset: effectiveOffset
		});
		logs = clamped.logs;
	}

	return {
		logs: logs.map((log) => ({ ...log, details: parseAuditLogDetails(log.details, log.id) })),
		total,
		limit: query.limit,
		offset: effectiveOffset,
		sortBy: query.sortBy,
		sortOrder: query.sortOrder,
		successFilter: query.successFilter
	};
};
