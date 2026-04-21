import { getResourceEvents } from '$lib/server/kubernetes/events.js';
import { resolveFluxResourceType } from './resolve-resource-type.js';

export function resourceEventsUseCase(params: {
	locals: App.Locals;
	name: string;
	namespace: string;
	resourceType: string;
}) {
	return getResourceEvents(
		params.namespace,
		params.name,
		resolveFluxResourceType(params.resourceType),
		params.locals.cluster
	);
}
