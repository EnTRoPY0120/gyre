import {
	buildOptimisticResource,
	isOptimisticAction,
	resolveResourceActionFeedback,
	type ResourceAction,
	type ResourceActionFeedback
} from './action-feedback';
import type { FluxResource } from '$lib/types/flux';

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

export interface OptimisticResourceActionOptions {
	request: ResourceActionRequest;
	resource: FluxResource;
	cacheKey: string;
	invalidateResource: (key: string) => Promise<unknown>;
	scheduleRetry: (retry: () => Promise<void>) => void;
	setResource: (resource: FluxResource) => void;
	fetcher?: typeof fetch;
}

export interface OptimisticResourceActionResult extends ResourceActionExecution {
	feedback: ResourceActionFeedback;
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

/** Apply an optimistic suspend/resume update and roll it back when mutation fails. */
export async function executeOptimisticResourceAction({
	request,
	resource,
	cacheKey,
	invalidateResource,
	scheduleRetry,
	setResource,
	fetcher
}: OptimisticResourceActionOptions): Promise<OptimisticResourceActionResult> {
	const originalResource = JSON.parse(JSON.stringify(resource)) as FluxResource;
	const optimistic = isOptimisticAction(request.action);
	if (optimistic) {
		setResource(buildOptimisticResource(resource, request.action));
	}

	const execution = await executeResourceAction(
		request,
		cacheKey,
		invalidateResource,
		scheduleRetry,
		fetcher
	);
	const feedback = resolveResourceActionFeedback({ ...execution, action: request.action });
	if (feedback.rollbackOptimistic && optimistic) {
		setResource(originalResource);
	}

	return { ...execution, feedback };
}
