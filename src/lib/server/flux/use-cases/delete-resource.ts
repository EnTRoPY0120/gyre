import { deleteFluxResource, type ReqCache } from '$lib/server/kubernetes/client.js';
import { resolveFluxResourceType } from './resolve-resource-type.js';

export function deleteResourceUseCase(params: {
	locals: App.Locals;
	name: string;
	namespace: string;
	reqCache?: ReqCache;
	resourceType: string;
}) {
	return deleteFluxResource(
		resolveFluxResourceType(params.resourceType),
		params.namespace,
		params.name,
		params.locals.cluster,
		params.reqCache
	);
}
