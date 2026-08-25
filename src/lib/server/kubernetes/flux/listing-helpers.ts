import type { FluxResource } from './types.js';
import { getResourceStatus } from './resource-status.js';

export interface ListOptions {
	limit?: number;
	offset?: number;
	sortBy?: 'name' | 'age' | 'status';
	sortOrder?: 'asc' | 'desc';
}

const STATUS_ORDER: Record<string, number> = {
	failed: 0,
	progressing: 1,
	suspended: 2,
	unknown: 3,
	healthy: 4
};

function sortResources(
	items: FluxResource[],
	sortBy: ListOptions['sortBy'],
	sortOrder: ListOptions['sortOrder'] = 'asc'
): FluxResource[] {
	return [...items].sort((a, b) => {
		let comparison = 0;
		if (sortBy === 'name') {
			comparison = (a.metadata.name ?? '').localeCompare(b.metadata.name ?? '');
		} else if (sortBy === 'age') {
			const aTime = a.metadata.creationTimestamp
				? new Date(a.metadata.creationTimestamp).getTime()
				: 0;
			const bTime = b.metadata.creationTimestamp
				? new Date(b.metadata.creationTimestamp).getTime()
				: 0;
			comparison = aTime - bTime;
		} else if (sortBy === 'status') {
			comparison =
				(STATUS_ORDER[getResourceStatus(a)] ?? 3) - (STATUS_ORDER[getResourceStatus(b)] ?? 3);
		}

		if (comparison === 0) {
			comparison = (a.metadata.uid ?? a.metadata.name ?? '').localeCompare(
				b.metadata.uid ?? b.metadata.name ?? ''
			);
		}
		return sortOrder === 'desc' ? -comparison : comparison;
	});
}

export function shouldUseNativePaging(options?: ListOptions): boolean {
	return !options?.sortBy && options?.limit !== undefined && (options?.offset ?? 0) === 0;
}

export function paginateResources(items: FluxResource[], options?: ListOptions) {
	const sorted = options?.sortBy ? sortResources(items, options.sortBy, options.sortOrder) : items;
	const total = sorted.length;
	const offset = options?.offset ?? 0;
	const paginatedItems =
		options?.limit !== undefined
			? sorted.slice(offset, offset + options.limit)
			: sorted.slice(offset);

	return {
		items: paginatedItems,
		total,
		hasMore: options?.limit !== undefined ? offset + options.limit < total : false,
		offset,
		limit: paginatedItems.length
	};
}
