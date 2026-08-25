import * as k8s from '@kubernetes/client-node';
import type { K8sEvent } from '$lib/types/events';

const FLUX_COMPONENTS = [
	'source-controller',
	'kustomize-controller',
	'helm-controller',
	'image-reflector-controller',
	'image-automation-controller',
	'notification-controller'
];

function toIsoTimestamp(value: Date | null | undefined): string | null {
	return value?.toISOString() || null;
}

export function mapKubernetesEvent(
	event: k8s.CoreV1Event,
	useFallbackTimestamps = false
): K8sEvent {
	const fallbackTimestamp = useFallbackTimestamps
		? event.eventTime || event.metadata?.creationTimestamp
		: undefined;

	return {
		type: (event.type as 'Normal' | 'Warning') || 'Normal',
		reason: event.reason || 'Unknown',
		message: event.message || '',
		count: event.count || 1,
		firstTimestamp: toIsoTimestamp(event.firstTimestamp || fallbackTimestamp),
		lastTimestamp: toIsoTimestamp(event.lastTimestamp || fallbackTimestamp),
		involvedObject: {
			kind: event.involvedObject?.kind || '',
			name: event.involvedObject?.name || '',
			namespace: event.involvedObject?.namespace || '',
			uid: event.involvedObject?.uid || ''
		},
		source: {
			component: event.source?.component || 'unknown'
		}
	};
}

export function isFluxEvent(event: k8s.CoreV1Event): boolean {
	const component = event.source?.component || '';
	const kind = event.involvedObject?.kind || '';
	return (
		FLUX_COMPONENTS.some((name) => component.includes(name)) ||
		/GitRepository|Kustomization|HelmRelease|HelmRepository|HelmChart|Bucket/.test(kind)
	);
}

export function compareEventsByRecentTimestamp(a: K8sEvent, b: K8sEvent): number {
	const timeA = a.lastTimestamp ? new Date(a.lastTimestamp).getTime() : 0;
	const timeB = b.lastTimestamp ? new Date(b.lastTimestamp).getTime() : 0;
	return timeB - timeA;
}
