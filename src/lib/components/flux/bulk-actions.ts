import type { FluxResource } from '$lib/types/flux';

export type BatchAction = 'suspend' | 'resume' | 'reconcile' | 'delete';

export interface BatchResourceItem {
	type: string;
	namespace: string;
	name: string;
}

export interface BatchOperationResult {
	resource: BatchResourceItem;
	success: boolean;
	message: string;
}

export interface BatchOperationResponse {
	results: BatchOperationResult[];
	summary: {
		total: number;
		successful: number;
		failed: number;
	};
}

export interface FailedBatchResource {
	resource: BatchResourceItem;
	message: string;
	originalResource: FluxResource;
}

function getBatchKey(resource: BatchResourceItem): string {
	return `${resource.type}:${resource.namespace}:${resource.name}`;
}

export function toBatchResourceItem(resource: FluxResource): BatchResourceItem {
	return {
		type: resource.kind || '',
		namespace: resource.metadata.namespace || '',
		name: resource.metadata.name || ''
	};
}

export function partitionBatchOperationResult(
	selectedResources: FluxResource[],
	response: BatchOperationResponse
) {
	const resourceMap = new Map(
		selectedResources.map((resource) => {
			const resourceItem = toBatchResourceItem(resource);
			return [getBatchKey(resourceItem), resource] as const;
		})
	);

	const failedResources = response.results
		.filter((result) => !result.success)
		.flatMap((result) => {
			const originalResource = resourceMap.get(getBatchKey(result.resource));
			if (!originalResource) {
				return [];
			}

			return [
				{
					resource: result.resource,
					message: result.message,
					originalResource
				}
			];
		});
	const allSucceeded =
		response.results.length > 0 && response.results.every((result) => result.success);
	const allFailed =
		response.results.length > 0 && response.results.every((result) => !result.success);

	return {
		failedResources,
		nextSelectedResources: failedResources.map((failure) => failure.originalResource),
		allSucceeded,
		allFailed
	};
}

export function buildRetryPayload(failedResources: FailedBatchResource[]): BatchResourceItem[] {
	return failedResources.map((failure) => failure.resource);
}
