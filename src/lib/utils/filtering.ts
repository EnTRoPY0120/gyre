import type { FluxResource } from '$lib/types/flux';
import { getResourceHealth, type ResourceHealth } from '$lib/utils/flux';
import { advancedSearch, parseQuery } from './search';

export interface FilterState {
	search: string;
	namespace: string;
	status: ResourceHealth | 'all';
	labels: string;
	useRegex?: boolean;
}

export const defaultFilterState: FilterState = {
	search: '',
	namespace: '',
	status: 'all',
	labels: '',
	useRegex: false
};

/**
 * Filter resources based on the current filter state
 */
export function filterResources(resources: FluxResource[], filters: FilterState): FluxResource[] {
	let results = resources;

	// Search filter (name, namespace, etc)
	if (filters.search) {
		const parsed = parseQuery(filters.search);
		results = advancedSearch(results, parsed.query, {
			regex: filters.useRegex,
			fuzzy: !filters.useRegex,
			keys: ['metadata.name', 'metadata.namespace', 'status.conditions.message']
		});

		// Apply tag-based filters from search query if any
		if (Object.keys(parsed.tags).length > 0) {
			results = results.filter((item) => {
				return Object.entries(parsed.tags).every(([key, value]) => {
					if (key === 'ns' || key === 'namespace') {
						return item.metadata?.namespace === value;
					}
					if (key === 'status') {
						const health = getResourceHealth(
							item.status?.conditions,
							item.spec?.suspend as boolean | undefined
						);
						return health.toLowerCase() === value.toLowerCase();
					}
					return true;
				});
			});
		}
	}

	return results.filter((resource) => {
		// Namespace filter (from dropdown)
		if (filters.namespace) {
			if (resource.metadata.namespace !== filters.namespace) {
				return false;
			}
		}

		// Status filter (from dropdown)
		if (filters.status !== 'all') {
			const health = getResourceHealth(
				resource.status?.conditions,
				resource.spec?.suspend as boolean | undefined
			);
			if (health !== filters.status) {
				return false;
			}
		}

		// Labels filter
		if (filters.labels) {
			const resourceLabels = resource.metadata.labels || {};
			const filterLabels = parseLabels(filters.labels);

			for (const [key, value] of Object.entries(filterLabels)) {
				if (resourceLabels[key] !== value) {
					return false;
				}
			}
		}

		return true;
	});
}

/**
 * Parse labels string into key-value pairs
 */
export function parseLabels(labelsStr: string): Record<string, string> {
	if (!labelsStr.trim()) return {};

	const labels: Record<string, string> = {};
	const pairs = labelsStr.split(',');

	for (const pair of pairs) {
		const [key, value] = pair.split('=').map((s) => s.trim());
		if (key && value !== undefined) {
			labels[key] = value;
		}
	}

	return labels;
}

/**
 * Get unique namespaces from a list of resources
 */
export function getUniqueNamespaces(resources: FluxResource[]): string[] {
	const namespaces = new Set<string>();

	for (const resource of resources) {
		if (resource.metadata.namespace) {
			namespaces.add(resource.metadata.namespace);
		}
	}

	return Array.from(namespaces).sort();
}

/**
 * Check if any filters are active
 */
export function hasActiveFilters(filters: FilterState): boolean {
	return (
		filters.search !== '' ||
		filters.namespace !== '' ||
		filters.status !== 'all' ||
		filters.labels !== ''
	);
}

/**
 * Convert filter state to URL search params
 */
export function filtersToSearchParams(filters: FilterState): URLSearchParams {
	const params = new URLSearchParams();

	if (filters.search) params.set('q', filters.search);
	if (filters.namespace) params.set('ns', filters.namespace);
	if (filters.status !== 'all') params.set('status', filters.status);
	if (filters.labels) params.set('labels', filters.labels);

	return params;
}

/**
 * Parse URL search params to filter state
 */
export function searchParamsToFilters(params: URLSearchParams): FilterState {
	return {
		search: params.get('q') || '',
		namespace: params.get('ns') || '',
		status: (params.get('status') as ResourceHealth) || 'all',
		labels: params.get('labels') || ''
	};
}
