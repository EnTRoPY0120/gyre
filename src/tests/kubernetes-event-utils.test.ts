import * as k8s from '@kubernetes/client-node';
import { describe, expect, test } from 'vitest';
import {
	compareEventsByRecentTimestamp,
	isFluxEvent,
	mapKubernetesEvent
} from '../lib/server/kubernetes/event-utils.js';

function makeEvent(overrides: Partial<k8s.CoreV1Event> = {}): k8s.CoreV1Event {
	return {
		type: 'Normal',
		reason: 'Reconciled',
		message: 'ok',
		count: 1,
		involvedObject: { kind: 'Kustomization', name: 'app', namespace: 'flux-system', uid: 'uid' },
		source: { component: 'kustomize-controller' },
		...overrides
	} as k8s.CoreV1Event;
}

describe('Kubernetes event helpers', () => {
	test('maps event fields and fallback timestamps', () => {
		const timestamp = new Date('2026-08-21T00:00:00.000Z');
		const event = mapKubernetesEvent(makeEvent({ eventTime: timestamp }), true);
		expect(event.lastTimestamp).toBe(timestamp.toISOString());
		expect(event.involvedObject.name).toBe('app');
	});

	test('recognizes Flux events and sorts newest first', () => {
		const fluxEvent = makeEvent();
		const otherEvent = makeEvent({
			involvedObject: { kind: 'Pod', name: 'pod', namespace: 'default', uid: 'pod-uid' },
			source: { component: 'scheduler' }
		});
		expect(isFluxEvent(fluxEvent)).toBe(true);
		expect(isFluxEvent(otherEvent)).toBe(false);

		const newer = mapKubernetesEvent(
			makeEvent({ lastTimestamp: new Date('2026-08-21T00:02:00.000Z') })
		);
		const older = mapKubernetesEvent(
			makeEvent({ lastTimestamp: new Date('2026-08-21T00:01:00.000Z') })
		);
		expect(compareEventsByRecentTimestamp(newer, older)).toBeLessThan(0);
	});
});
