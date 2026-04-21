import { rollbackResource } from '$lib/server/kubernetes/flux/history.js';
import { resolveFluxResourceType } from './resolve-resource-type.js';

export function rollbackResourceUseCase(params: {
	locals: App.Locals;
	name: string;
	namespace: string;
	resourceType: string;
	revisionId: string;
}) {
	return rollbackResource(
		resolveFluxResourceType(params.resourceType),
		params.namespace,
		params.name,
		params.revisionId,
		params.locals.cluster
	);
}
