import type { K8sEvent, ReconciliationEntry } from '$lib/types/resource';

export interface ResourceEventsResponse {
	events: K8sEvent[];
}

export interface ResourceLogsResponse {
	logs: string;
}

export interface ResourceHistoryResponse {
	timeline: ReconciliationEntry[];
}

export interface ResourceRollbackRequest {
	historyId: string;
	revision: string | null;
}

export interface ResourceRequestError {
	message: string;
}

export type ResourceLoadResult<T> =
	| { response: T }
	| { error: ResourceRequestError }
	| { aborted: true };

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
	const contentType = response.headers.get('content-type') ?? '';
	if (contentType.includes('application/json')) {
		const body = await response.json().catch(() => null);
		if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
			return body.message;
		}
	} else {
		const body = await response.text().catch(() => '');
		if (body) return body;
	}

	return fallback;
}

function isAbortError(error: unknown): boolean {
	return error instanceof Error && error.name === 'AbortError';
}

/** Load resource events and keep aborts separate from user-visible failures. */
export async function loadResourceEvents(
	url: string,
	signal: AbortSignal,
	fetcher: typeof fetch = fetch
): Promise<ResourceLoadResult<ResourceEventsResponse>> {
	try {
		const response = await fetcher(url, { signal });
		if (!response.ok) {
			return { error: { message: `Failed to fetch events: ${response.statusText}` } };
		}

		const body = (await response.json()) as { events?: K8sEvent[] };
		return { response: { events: body.events || [] } };
	} catch (error) {
		if (isAbortError(error)) return { aborted: true };
		return { error: { message: error instanceof Error ? error.message : 'Failed to load events' } };
	}
}

/** Load controller logs and keep aborts separate from user-visible failures. */
export async function loadResourceLogs(
	url: string,
	signal: AbortSignal,
	fetcher: typeof fetch = fetch
): Promise<ResourceLoadResult<ResourceLogsResponse>> {
	try {
		const response = await fetcher(url, { signal });
		if (!response.ok) {
			return {
				error: {
					message: await readErrorMessage(response, `Failed to fetch logs: ${response.statusText}`)
				}
			};
		}

		const body = (await response.json()) as { logs?: unknown };
		return { response: { logs: typeof body.logs === 'string' ? body.logs : '' } };
	} catch (error) {
		if (isAbortError(error)) return { aborted: true };
		return { error: { message: error instanceof Error ? error.message : 'Failed to load logs' } };
	}
}

/** Load reconciliation history and keep aborts separate from user-visible failures. */
export async function loadResourceHistory(
	url: string,
	signal: AbortSignal,
	fetcher: typeof fetch = fetch
): Promise<ResourceLoadResult<ResourceHistoryResponse>> {
	try {
		const response = await fetcher(url, { signal });
		if (!response.ok) {
			return { error: { message: `Failed to fetch history: ${response.statusText}` } };
		}

		const body = (await response.json()) as { timeline?: ReconciliationEntry[] };
		return { response: { timeline: body.timeline || [] } };
	} catch (error) {
		if (isAbortError(error)) return { aborted: true };
		return {
			error: { message: error instanceof Error ? error.message : 'Failed to load history' }
		};
	}
}

/** Start a rollback and normalize endpoint failures for the resource detail page. */
export async function requestResourceRollback(
	url: string,
	request: ResourceRollbackRequest,
	csrfToken: string,
	fetcher: typeof fetch = fetch
): Promise<void> {
	const response = await fetcher(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
		body: JSON.stringify(request)
	});

	if (!response.ok) {
		throw new Error(await readErrorMessage(response, 'Rollback failed'));
	}
}
