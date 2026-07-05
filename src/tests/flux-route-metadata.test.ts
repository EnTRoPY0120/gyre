import { describe, expect, test } from 'vitest';
import {
	createFluxResourceActionMetadata,
	fluxResourceParamsSchema
} from '../lib/server/openapi/flux-route-metadata.js';

describe('Flux route metadata helpers', () => {
	test('shared param schema includes resourceType, namespace, and name', () => {
		const keys = Object.keys(fluxResourceParamsSchema.shape);
		expect(keys).toEqual(['resourceType', 'namespace', 'name']);
	});

	test('action metadata preserves route-specific descriptions', () => {
		const metadata = createFluxResourceActionMetadata({
			summary: 'Resume resource',
			description: 'Resume reconciliation for a suspended FluxCD resource.',
			successDescription: 'Resource resumed successfully',
			includeInternalServerError: true
		});

		expect(metadata.summary).toBe('Resume resource');
		expect(metadata.description).toBe('Resume reconciliation for a suspended FluxCD resource.');
		expect(metadata.responses[200].description).toBe('Resource resumed successfully');
		expect(metadata.responses[500]).toEqual({ description: 'Internal server error' });
	});
});
