import { getCoreV1Api, handleK8sError, OPERATION_TIMEOUTS } from './client';
import type { K8sEvent } from '$lib/types/events';
import { compareEventsByRecentTimestamp, isFluxEvent, mapKubernetesEvent } from './event-utils.js';

export type { K8sEvent };

/**
 * Fetch events related to a specific Kubernetes resource
 */
export async function getResourceEvents(
	namespace: string,
	resourceName: string,
	resourceKind: string,
	context?: string
): Promise<K8sEvent[]> {
	const coreApi = await getCoreV1Api(context, undefined, OPERATION_TIMEOUTS.get);

	try {
		// Fetch events from the namespace, filtered by involved object name
		const response = await coreApi.listNamespacedEvent({
			namespace,
			fieldSelector: `involvedObject.name=${resourceName},involvedObject.kind=${resourceKind}`
		});

		const events: K8sEvent[] = (response.items || [])
			.map((event) => mapKubernetesEvent(event))
			.sort(compareEventsByRecentTimestamp);

		return events;
	} catch (error) {
		throw handleK8sError(error, `fetch events for ${resourceName}`);
	}
}

/**
 * Fetch all recent events from the cluster related to FluxCD
 */
export async function getAllRecentEvents(limit = 10, context?: string): Promise<K8sEvent[]> {
	const coreApi = await getCoreV1Api(context, undefined, OPERATION_TIMEOUTS.get);

	try {
		// Fetch all events, but we'll filter them by source component or involveObject kind
		// Common Flux components: source-controller, kustomize-controller, helm-controller, image-reflector-controller, image-automation-controller
		const response = await coreApi.listEventForAllNamespaces({
			limit: 50 // Get a bunch and filter
		});

		const events: K8sEvent[] = (response.items || [])
			.filter(isFluxEvent)
			.map((event) => mapKubernetesEvent(event, true))
			.sort(compareEventsByRecentTimestamp)
			.slice(0, limit);

		return events;
	} catch (error) {
		throw handleK8sError(error, 'fetch all recent events');
	}
}
