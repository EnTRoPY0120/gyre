import { describe, expect, test } from 'vitest';
import { z } from '../lib/server/openapi';
import {
	createFluxResourceActionMetadata,
	createFluxResourceReadMetadata,
	fluxResourceParamsSchema
} from '../lib/server/openapi/flux-route-metadata.js';
import { createRegistry, generateOpenApiSpec } from '../lib/server/openapi.js';
import { registerApiRoutes, toOpenApiPath } from '../lib/server/openapi-route.js';

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

	test('read metadata preserves read descriptions and shared params schema', () => {
		const responseSchema = z.object({ name: z.string() });
		const metadata = createFluxResourceReadMetadata({
			summary: 'Get resource',
			description: 'Read a FluxCD resource.',
			responseDescription: 'Flux resource details',
			responseSchema,
			includeInternalServerError: true
		});

		expect(metadata.summary).toBe('Get resource');
		expect(metadata.description).toBe('Read a FluxCD resource.');
		expect(metadata.request.params).toBe(fluxResourceParamsSchema);
		expect(metadata.responses[200].description).toBe('Flux resource details');
		expect(metadata.responses[200].content['application/json'].schema).toBe(responseSchema);
		expect(metadata.responses[500]).toEqual({ description: 'Internal server error' });
	});

	test('converts Svelte route parameters into OpenAPI paths', () => {
		expect(toOpenApiPath('/src/routes/api/v1/flux/[resourceType]/+server.ts')).toBe(
			'/api/v1/flux/{resourceType}'
		);
	});

	test('registers only metadata-bearing routes with normalized methods', () => {
		const registry = createRegistry();
		registerApiRoutes(registry, {
			'/src/routes/api/v1/resources/[id]/+server.ts': {
				_metadata: {
					GET: {
						summary: 'Read resource',
						responses: { 200: { description: 'Resource returned' } }
					}
				}
			},
			'/src/routes/api/v1/internal/+server.ts': {}
		});

		const spec = generateOpenApiSpec(registry);
		expect(spec.paths['/api/v1/resources/{id}']).toMatchObject({
			get: { summary: 'Read resource' }
		});
		expect(spec.paths['/api/v1/internal']).toBeUndefined();
	});
});
