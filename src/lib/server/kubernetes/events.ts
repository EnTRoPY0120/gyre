import { getKubeConfig } from './client';
import * as k8s from '@kubernetes/client-node';

export interface K8sEvent {
	type: 'Normal' | 'Warning';
	reason: string;
	message: string;
	count: number;
	firstTimestamp: string | null;
	lastTimestamp: string | null;
	involvedObject: {
		kind: string;
		name: string;
		namespace: string;
		uid: string;
	};
	source: {
		component: string;
	};
}

/**
 * Fetch events related to a specific Kubernetes resource
 */
export async function getResourceEvents(
	namespace: string,
	resourceName: string,
	resourceKind: string,
	context?: string
): Promise<K8sEvent[]> {
	const config = await getKubeConfig(context);
	const coreApi = config.makeApiClient(k8s.CoreV1Api);

	try {
		// Fetch events from the namespace, filtered by involved object name
		const response = await coreApi.listNamespacedEvent({
			namespace,
			fieldSelector: `involvedObject.name=${resourceName},involvedObject.kind=${resourceKind}`
		});

		const events: K8sEvent[] = (response.items || [])
			.map((event: k8s.CoreV1Event) => ({
				type: (event.type as 'Normal' | 'Warning') || 'Normal',
				reason: event.reason || 'Unknown',
				message: event.message || '',
				count: event.count || 1,
				firstTimestamp: event.firstTimestamp?.toISOString() || null,
				lastTimestamp: event.lastTimestamp?.toISOString() || null,
				involvedObject: {
					kind: event.involvedObject?.kind || '',
					name: event.involvedObject?.name || '',
					namespace: event.involvedObject?.namespace || '',
					uid: event.involvedObject?.uid || ''
				},
				source: {
					component: event.source?.component || 'unknown'
				}
			}))
			// Sort by lastTimestamp descending (most recent first)
			.sort((a: K8sEvent, b: K8sEvent) => {
				const timeA = a.lastTimestamp ? new Date(a.lastTimestamp).getTime() : 0;
				const timeB = b.lastTimestamp ? new Date(b.lastTimestamp).getTime() : 0;
				return timeB - timeA;
			});

		return events;
	} catch (error) {
		console.error('Failed to fetch events:', error);
		throw error;
	}
}

/**
 * Fetch all recent events from the cluster related to FluxCD
 */
export async function getAllRecentEvents(limit = 10, context?: string): Promise<K8sEvent[]> {
	const config = await getKubeConfig(context);
	const coreApi = config.makeApiClient(k8s.CoreV1Api);

	try {
		// Fetch all events, but we'll filter them by source component or involveObject kind
		// Common Flux components: source-controller, kustomize-controller, helm-controller, image-reflector-controller, image-automation-controller
		const response = await coreApi.listEventForAllNamespaces({
			limit: 50 // Get a bunch and filter
		});

		const fluxComponents = [
			'source-controller',
			'kustomize-controller',
			'helm-controller',
			'image-reflector-controller',
			'image-automation-controller',
			'notification-controller'
		];

		const events: K8sEvent[] = (response.items || [])
			.filter((event: k8s.CoreV1Event) => {
				const component = event.source?.component || '';
				const kind = event.involvedObject?.kind || '';
				return (
					fluxComponents.some((c) => component.includes(c)) ||
					kind.match(/GitRepository|Kustomization|HelmRelease|HelmRepository|HelmChart|Bucket/)
				);
			})
			.map((event: k8s.CoreV1Event) => ({
				type: (event.type as 'Normal' | 'Warning') || 'Normal',
				reason: event.reason || 'Unknown',
				message: event.message || '',
				count: event.count || 1,
				firstTimestamp:
					(
						event.firstTimestamp ||
						event.eventTime ||
						event.metadata?.creationTimestamp
					)?.toISOString() || null,
				lastTimestamp:
					(
						event.lastTimestamp ||
						event.eventTime ||
						event.metadata?.creationTimestamp
					)?.toISOString() || null,
				involvedObject: {
					kind: event.involvedObject?.kind || '',
					name: event.involvedObject?.name || '',
					namespace: event.involvedObject?.namespace || '',
					uid: event.involvedObject?.uid || ''
				},
				source: {
					component: event.source?.component || 'unknown'
				}
			}))
			.sort((a, b) => {
				const timeA = a.lastTimestamp ? new Date(a.lastTimestamp).getTime() : 0;
				const timeB = b.lastTimestamp ? new Date(b.lastTimestamp).getTime() : 0;
				return timeB - timeA;
			})
			.slice(0, limit);

		return events;
	} catch (error) {
		console.error('Failed to fetch all events:', error);
		return [];
	}
}

/**
 * Format event timestamp as relative time
 */
export function formatEventTime(timestamp: string | null): string {
	if (!timestamp) return 'Unknown';

	const now = new Date();
	const eventTime = new Date(timestamp);
	const diffMs = now.getTime() - eventTime.getTime();
	const diffSeconds = Math.floor(diffMs / 1000);
	const diffMinutes = Math.floor(diffSeconds / 60);
	const diffHours = Math.floor(diffMinutes / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffSeconds < 60) return `${diffSeconds}s ago`;
	if (diffMinutes < 60) return `${diffMinutes}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;

	return eventTime.toLocaleDateString();
}
