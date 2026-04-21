import { createFluxResource, type ReqCache } from '$lib/server/kubernetes/client.js';
import { resolveFluxResourceType } from './resolve-resource-type.js';

export function createResourceUseCase(params: {
	body: Record<string, unknown>;
	locals: App.Locals;
	namespace: string;
	reqCache?: ReqCache;
	resourceType: string;
}) {
	return createFluxResource(
		resolveFluxResourceType(params.resourceType),
		params.namespace,
		params.body,
		params.locals.cluster,
		params.reqCache
	);
}
