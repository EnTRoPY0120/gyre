import type { ResourceAction } from './action-feedback';

export interface ResourceActionRequest {
	type: string;
	namespace: string;
	name: string;
	action: ResourceAction;
	csrfToken: string;
}

export interface ResourceActionExecution {
	mutationError: Error | null;
	invalidateError: Error | null;
}

/** Execute a Flux resource action and normalize the endpoint's error contract. */
export async function postResourceAction(
	request: ResourceActionRequest,
	fetcher: typeof fetch = fetch
): Promise<void> {
	const response = await fetcher(
		`/api/v1/flux/${encodeURIComponent(request.type)}/${encodeURIComponent(request.namespace)}/${encodeURIComponent(request.name)}/${encodeURIComponent(request.action)}`,
		{
			method: 'POST',
			headers: { 'X-CSRF-Token': request.csrfToken }
		}
	);

	if (response.ok) return;

	const data = (await response.json().catch(() => ({}))) as { message?: string };
	throw new Error(data.message || `Failed to ${request.action} resource`);
}

/** Run the mutation and refresh, exposing refresh retry scheduling to the UI. */
export async function executeResourceAction(
	request: ResourceActionRequest,
	cacheKey: string,
	invalidateResource: (key: string) => Promise<unknown>,
	scheduleRetry: (retry: () => Promise<void>) => void,
	fetcher: typeof fetch = fetch
): Promise<ResourceActionExecution> {
	let mutationError: Error | null = null;
	let invalidateError: Error | null = null;

	try {
		await postResourceAction(request, fetcher);
	} catch (error) {
		mutationError = error as Error;
	}

	if (!mutationError) {
		try {
			await invalidateResource(cacheKey);
		} catch (error) {
			invalidateError = error as Error;
			scheduleRetry(async () => {
				await invalidateResource(cacheKey).catch(() => {});
			});
		}
	}

	return { mutationError, invalidateError };
}
