import type { DiffResponse } from '$lib/types/resource';

export interface ResourceDiffError {
	code?: string;
	message: string;
}

export type ResourceDiffRequestResult = { response: DiffResponse } | { error: ResourceDiffError };

export type ResourceDiffLoadResult = ResourceDiffRequestResult | { aborted: true };

/** Request a resource diff and normalize non-success API responses. */
export async function requestResourceDiff(
	url: string,
	signal: AbortSignal,
	fetcher: typeof fetch = fetch
): Promise<ResourceDiffRequestResult> {
	const response = await fetcher(url, { signal });
	if (!response.ok) {
		const errorData = await response
			.json()
			.catch(() => ({}) as { code?: string; message?: string });
		return {
			error: { code: errorData.code, message: errorData.message || response.statusText }
		};
	}

	return { response: (await response.json()) as DiffResponse };
}

/** Add force-refresh semantics and normalize abort/network failures for the page. */
export async function loadResourceDiff(
	url: string,
	force: boolean,
	signal: AbortSignal,
	fetcher: typeof fetch = fetch
): Promise<ResourceDiffLoadResult> {
	const requestUrl = new URL(url);
	if (force) requestUrl.searchParams.set('force', 'true');

	try {
		return await requestResourceDiff(requestUrl.toString(), signal, fetcher);
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') return { aborted: true };
		return {
			error: {
				code: undefined,
				message: error instanceof Error ? error.message : 'Failed to load diff'
			}
		};
	}
}
