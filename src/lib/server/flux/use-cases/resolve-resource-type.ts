import {
	getResourceDef,
	getResourceTypeByPlural,
	type FluxResourceType
} from '$lib/server/kubernetes/flux/resources.js';

export function resolveFluxResourceType(resourceType: string): FluxResourceType {
	const fromPlural = getResourceTypeByPlural(resourceType);
	const candidate = (fromPlural ?? resourceType) as FluxResourceType;
	if (!getResourceDef(candidate)) {
		throw new Error(`Unknown resource type: ${resourceType}`);
	}
	return candidate;
}
