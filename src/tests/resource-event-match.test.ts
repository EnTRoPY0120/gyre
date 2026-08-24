import { describe, expect, test } from 'vitest';
import { matchesResourceEvent } from '../routes/resources/[type]/[namespace]/[name]/resource-event-match.js';
import type { ResourceEvent } from '../lib/stores/events/types.js';

const event: ResourceEvent = {
	type: 'MODIFIED',
	resourceType: 'kustomizations',
	timestamp: '2026-08-24T00:00:00.000Z',
	resource: {
		metadata: { name: 'app', namespace: 'flux-system', uid: 'uid' }
	}
};

describe('matchesResourceEvent', () => {
	test('matches resource type, namespace, and name', () => {
		expect(matchesResourceEvent(event, 'kustomizations', 'flux-system', 'app')).toBe(true);
	});

	test('accepts a Flux kind as a fallback for the event type', () => {
		const kindEvent = {
			...event,
			resourceType: undefined,
			resource: { ...event.resource, kind: 'Kustomization' }
		};
		expect(matchesResourceEvent(kindEvent, 'kustomizations', 'flux-system', 'app')).toBe(true);
	});

	test('rejects missing or mismatched resource identity', () => {
		expect(
			matchesResourceEvent(
				{ ...event, resource: undefined },
				'kustomizations',
				'flux-system',
				'app'
			)
		).toBe(false);
		expect(matchesResourceEvent(event, 'gitrepositories', 'flux-system', 'app')).toBe(false);
		expect(matchesResourceEvent(event, 'kustomizations', 'default', 'app')).toBe(false);
	});
});
