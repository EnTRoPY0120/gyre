import { describe, expect, test } from 'vitest';
import {
	getResourceUpdateError,
	validateResourceYaml
} from '../lib/components/flux/edit-resource.js';

const validYaml = `apiVersion: source.toolkit.fluxcd.io/v1\nkind: GitRepository\nmetadata:\n  name: source\n  namespace: flux-system\n`;

describe('validateResourceYaml', () => {
	test('accepts a resource with matching identity', () => {
		expect(validateResourceYaml(validYaml, 'source', 'flux-system')).toBeNull();
	});

	test('rejects malformed and structurally incomplete YAML', () => {
		expect(validateResourceYaml('not: [valid', 'source', 'flux-system')).toContain(
			'unexpected end'
		);
		expect(validateResourceYaml('kind: GitRepository', 'source', 'flux-system')).toBe(
			'Invalid resource: missing required fields (apiVersion, kind, metadata)'
		);
	});

	test('rejects resource name and namespace mismatches', () => {
		expect(validateResourceYaml(validYaml, 'other', 'flux-system')).toBe(
			'Resource name mismatch: expected "other", got "source"'
		);
		expect(validateResourceYaml(validYaml, 'source', 'default')).toBe(
			'Namespace mismatch: expected "default", got "flux-system"'
		);
	});
});

describe('getResourceUpdateError', () => {
	test('prefers endpoint error and message fields', async () => {
		expect(
			await getResourceUpdateError(
				new Response(JSON.stringify({ error: 'API failed' }), {
					status: 400,
					statusText: 'Bad Request'
				})
			)
		).toBe('API failed');
		expect(
			await getResourceUpdateError(
				new Response(JSON.stringify({ message: 'API message' }), {
					status: 400,
					statusText: 'Bad Request'
				})
			)
		).toBe('API message');
	});

	test('falls back to response text and status text', async () => {
		expect(
			await getResourceUpdateError(
				new Response('plain failure', { status: 500, statusText: 'Server Error' })
			)
		).toBe('plain failure');
		expect(
			await getResourceUpdateError(new Response('', { status: 500, statusText: 'Server Error' }))
		).toBe('Failed to update resource: Server Error');
	});
});
