import type { FluxResource } from '$lib/types/flux';
import { fetchWithRetry } from '$lib/utils/fetch';

/** Fetch a resource list, treating client errors as an empty list for the cache. */
export async function fetchResourceList(
	url: string,
	resourceType: string,
	fetcher: typeof fetch = fetchWithRetry
): Promise<FluxResource[]> {
	const response = await fetcher(url);
	if (!response.ok) {
		if (response.status >= 400 && response.status < 500) return [];
		throw new Error(`Failed to fetch ${resourceType} list: ${response.status}`);
	}

	const data = (await response.json()) as { items?: unknown };
	return Array.isArray(data.items) ? (data.items as FluxResource[]) : [];
}

/** Fetch one resource, using null for client errors so callers can invalidate stale entries. */
export async function fetchResourceDetail(
	url: string,
	resourceType: string,
	resourcePath: string,
	fetcher: typeof fetch = fetchWithRetry
): Promise<FluxResource | null> {
	const response = await fetcher(url);
	if (!response.ok) {
		if (response.status >= 400 && response.status < 500) return null;
		throw new Error(`Failed to fetch ${resourceType}/${resourcePath}: ${response.status}`);
	}

	return (await response.json()) as FluxResource;
}
