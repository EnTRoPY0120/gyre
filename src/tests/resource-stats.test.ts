import { describe, expect, test } from 'vitest';
import { getResourceStats } from '../routes/resources/[type]/resource-stats.js';
import type { FluxResource } from '../lib/types/flux.js';

function resource(overrides: Partial<FluxResource> = {}): FluxResource {
	return {
		apiVersion: 'v1',
		kind: 'Kustomization',
		metadata: { name: 'resource', generation: 2 },
		...overrides
	};
}

describe('getResourceStats', () => {
	test('counts resources by derived health and excludes unknown from status totals', () => {
		const stats = getResourceStats([
			resource({ status: { conditions: [{ type: 'Ready', status: 'True' }] } }),
			resource({
				status: { conditions: [{ type: 'Ready', status: 'False', reason: 'Progressing' }] }
			}),
			resource({ status: { conditions: [{ type: 'Stalled', status: 'True' }] } }),
			resource({ spec: { suspend: true } }),
			resource()
		]);

		expect(stats).toEqual({
			total: 5,
			healthy: 1,
			progressing: 1,
			failed: 1,
			suspended: 1
		});
	});

	test('recognizes a resource that is behind its observed generation as progressing', () => {
		expect(
			getResourceStats([
				resource({
					status: { conditions: [{ type: 'Ready', status: 'True' }], observedGeneration: 1 }
				})
			])
		).toMatchObject({ total: 1, progressing: 1, healthy: 0 });
	});
});
