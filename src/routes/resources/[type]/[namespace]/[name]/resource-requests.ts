export interface ResourceLogsResponse {
	logs: string;
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
