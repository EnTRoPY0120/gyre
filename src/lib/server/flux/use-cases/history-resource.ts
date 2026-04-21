import { getResourceHistory } from '$lib/server/kubernetes/flux/history.js';
import { resolveFluxResourceType } from './resolve-resource-type.js';

export function historyResourceUseCase(params: {
	locals: App.Locals;
	name: string;
	namespace: string;
	resourceType: string;
}) {
	return getResourceHistory(
		resolveFluxResourceType(params.resourceType),
		params.namespace,
		params.name,
		params.locals.cluster
	);
}
