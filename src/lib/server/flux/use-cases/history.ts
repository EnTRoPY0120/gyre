export type ReconciliationStatusFilter = 'success' | 'failure' | 'unknown';

export interface HistoryQueryOptions {
	limit: number;
	since?: Date;
	status?: ReconciliationStatusFilter;
}

const allowedStatuses = ['success', 'failure', 'unknown'];

export function parseHistoryQuery(searchParams: URLSearchParams): HistoryQueryOptions {
	const limitParam = searchParams.get('limit');
	const parsedLimit = limitParam ? parseInt(limitParam, 10) : 100;
	const limit = Number.isNaN(parsedLimit) ? 100 : Math.min(Math.max(parsedLimit, 1), 1000);

	const statusParam = searchParams.get('status');
	const status =
		statusParam && allowedStatuses.includes(statusParam)
			? (statusParam as ReconciliationStatusFilter)
			: undefined;

	const sinceParam = searchParams.get('since');
	let since: Date | undefined;
	if (sinceParam) {
		const sinceDate = new Date(sinceParam);
		since = Number.isNaN(sinceDate.getTime()) ? undefined : sinceDate;
	}

	return { limit, status, since };
}
