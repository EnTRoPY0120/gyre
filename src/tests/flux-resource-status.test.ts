import { describe, expect, test } from 'vitest';
import { getResourceStatus } from '../lib/server/kubernetes/flux/resource-status.js';
import type { FluxResource } from '../lib/server/kubernetes/flux/types.js';

function resource(overrides: Partial<FluxResource> = {}): FluxResource {
	return {
		apiVersion: 'source.toolkit.fluxcd.io/v1',
		kind: 'GitRepository',
		metadata: { name: 'example' },
		...overrides
	};
}

describe('getResourceStatus', () => {
	test('prioritizes suspended resources', () => {
		expect(
			getResourceStatus(
				resource({
					spec: { suspend: true },
					status: { conditions: [{ type: 'Ready', status: 'False', reason: 'Failed' }] }
				})
			)
		).toBe('suspended');
	});

	test('returns failed for stalled conditions before generation drift', () => {
		expect(
			getResourceStatus(
				resource({
					metadata: { name: 'example', generation: 2 },
					status: {
						observedGeneration: 1,
						conditions: [{ type: 'Stalled', status: 'True' }]
					}
				})
			)
		).toBe('failed');
	});

	test('returns progressing for an unobserved generation', () => {
		expect(
			getResourceStatus(
				resource({
					metadata: { name: 'example', generation: 2 },
					status: { observedGeneration: 1, conditions: [{ type: 'Ready', status: 'True' }] }
				})
			)
		).toBe('progressing');
	});

	test('uses progressing reasons and then healthy condition status', () => {
		expect(
			getResourceStatus(
				resource({
					status: {
						conditions: [{ type: 'Ready', status: 'False', reason: 'DependencyNotReady' }]
					}
				})
			)
		).toBe('progressing');
		expect(
			getResourceStatus(resource({ status: { conditions: [{ type: 'Healthy', status: 'True' }] } }))
		).toBe('healthy');
	});

	test('returns unknown when no recognized condition is present', () => {
		expect(
			getResourceStatus(
				resource({ status: { conditions: [{ type: 'Reconciling', status: 'Unknown' }] } })
			)
		).toBe('unknown');
	});
});
