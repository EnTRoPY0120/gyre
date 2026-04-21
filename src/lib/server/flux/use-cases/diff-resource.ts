import { resolveFluxResourceType } from './resolve-resource-type.js';

export interface DiffResourceUseCaseParams {
	locals: App.Locals;
	name: string;
	namespace: string;
	resourceType: string;
}

export function normalizeDiffResourceParams(params: DiffResourceUseCaseParams) {
	return {
		...params,
		resourceType: resolveFluxResourceType(params.resourceType)
	};
}
