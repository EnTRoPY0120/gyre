import { describe, expect, test } from 'vitest';
import { getResourceStatus } from '../lib/server/kubernetes/flux/resource-status.js';
import { getHealthLabel } from '../lib/utils/flux.js';
import { getStatusBadgeStyles } from '../lib/components/flux/status-badge-styles.js';
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

describe('health presentation helpers', () => {
	test('maps every health state to its user-facing label', () => {
		expect(getHealthLabel('healthy')).toBe('Ready');
		expect(getHealthLabel('progressing')).toBe('Progressing');
		expect(getHealthLabel('failed')).toBe('Failed');
		expect(getHealthLabel('suspended')).toBe('Suspended');
		expect(getHealthLabel('unknown')).toBe('Unknown');
	});

	test('keeps badge styles aligned with health state', () => {
		expect(getStatusBadgeStyles('healthy')).toMatchObject({ icon: 'text-emerald-500' });
		expect(getStatusBadgeStyles('progressing')).toMatchObject({ icon: 'text-primary' });
		expect(getStatusBadgeStyles('failed')).toMatchObject({ icon: 'text-red-500' });
		expect(getStatusBadgeStyles('suspended')).toMatchObject({ icon: 'text-amber-500' });
		expect(getStatusBadgeStyles('unknown')).toMatchObject({ icon: 'text-zinc-500' });
	});
});
