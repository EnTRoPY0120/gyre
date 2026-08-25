import { resolveResourceRouteType } from '$lib/config/resources';
import type { ResourceEvent } from '$lib/stores/events/types.js';

/** Check whether an SSE event belongs to the resource currently displayed. */
export function matchesResourceEvent(
	event: ResourceEvent,
	resourceType: string,
	namespace: string,
	name: string
): boolean {
	const eventKind =
		typeof event.resource === 'object' && event.resource !== null && 'kind' in event.resource
			? String((event.resource as { kind?: string }).kind ?? '')
			: '';
	const resolvedEventType =
		resolveResourceRouteType(event.resourceType ?? '') ?? resolveResourceRouteType(eventKind);

	return (
		Boolean(event.resource) &&
		event.resource?.metadata.name === name &&
		event.resource?.metadata.namespace === namespace &&
		resolvedEventType === resourceType
	);
}
