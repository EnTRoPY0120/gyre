import { updateFluxResource, type ReqCache } from '$lib/server/kubernetes/client.js';
import { resolveFluxResourceType } from './resolve-resource-type.js';

export function updateResourceUseCase(params: {
	body: Record<string, unknown>;
	locals: App.Locals;
	name: string;
	namespace: string;
	reqCache?: ReqCache;
	resourceType: string;
}) {
	return updateFluxResource(
		resolveFluxResourceType(params.resourceType),
		params.namespace,
		params.name,
		params.body,
		params.locals.cluster,
		params.reqCache
	);
}
