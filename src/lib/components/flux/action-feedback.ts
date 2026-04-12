import type { FluxResource } from '$lib/types/flux';

export type ResourceAction = 'suspend' | 'resume' | 'reconcile';
export type ActionFeedbackTone = 'error' | 'warning';

export interface ResourceActionFeedback {
	rollbackOptimistic: boolean;
	tone: ActionFeedbackTone | null;
	message: string | null;
}

export function isOptimisticAction(action: ResourceAction): boolean {
	return action === 'suspend' || action === 'resume';
}

export function buildOptimisticResource(resource: FluxResource, action: ResourceAction): FluxResource {
	const optimisticResource = JSON.parse(JSON.stringify(resource)) as FluxResource;

	if (action === 'suspend' || action === 'resume') {
		optimisticResource.spec = optimisticResource.spec || {};
		optimisticResource.spec.suspend = action === 'suspend';
	}

	return optimisticResource;
}

export function resolveResourceActionFeedback(params: {
	action: ResourceAction;
	mutationError?: Error | null;
	invalidateError?: Error | null;
}): ResourceActionFeedback {
	if (params.mutationError) {
		return {
			rollbackOptimistic: isOptimisticAction(params.action),
			tone: 'error',
			message: params.mutationError.message
		};
	}

	if (params.invalidateError) {
		return {
			rollbackOptimistic: false,
			tone: 'warning',
			message: 'Action applied, but refresh failed'
		};
	}

	return {
		rollbackOptimistic: false,
		tone: null,
		message: null
	};
}
