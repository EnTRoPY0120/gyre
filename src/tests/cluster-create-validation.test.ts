import { describe, expect, test } from 'vitest';
import { REQUEST_LIMITS } from '../lib/server/request-limits.js';
import { validateClusterCreateInput } from '../routes/admin/clusters/create-validation.js';

const validKubeconfig = `apiVersion: v1
kind: Config
clusters: []
contexts: []
`;

function input(overrides: Partial<Parameters<typeof validateClusterCreateInput>[0]> = {}) {
	return {
		name: 'demo-cluster',
		description: 'A test cluster',
		kubeconfig: validKubeconfig,
		...overrides
	};
}

describe('validateClusterCreateInput', () => {
	test('accepts valid input', () => {
		expect(validateClusterCreateInput(input())).toBeNull();
	});

	test('validates required fields and lengths', () => {
		expect(validateClusterCreateInput(input({ name: '' }))).toEqual({
			status: 400,
			error: 'Name and kubeconfig are required'
		});
		expect(validateClusterCreateInput(input({ name: 'ab' }))?.error).toBe(
			'Name must be at least 3 characters'
		);
		expect(validateClusterCreateInput(input({ name: 'x'.repeat(101) }))?.error).toBe(
			'Name must be at most 100 characters'
		);
		expect(validateClusterCreateInput(input({ description: 'x'.repeat(501) }))?.error).toBe(
			'Description must be at most 500 characters'
		);
	});

	test('rejects kubeconfigs above the upload limit', () => {
		const oversized = 'x'.repeat(REQUEST_LIMITS.KUBECONFIG_UPLOAD + 1);
		const result = validateClusterCreateInput(input({ kubeconfig: oversized }));
		expect(result?.status).toBe(413);
		expect(result?.error).toContain('Kubeconfig is too large');
	});

	test('validates kubeconfig shape and metadata', () => {
		expect(validateClusterCreateInput(input({ kubeconfig: 'clusters: []' }))?.error).toBe(
			'Invalid kubeconfig: missing clusters or contexts'
		);
		expect(
			validateClusterCreateInput(
				input({ kubeconfig: 'kind: Config\napiVersion: v2\nclusters: []\ncontexts: []' })
			)?.error
		).toBe('Invalid kubeconfig: must have kind: Config and apiVersion: v1');
		expect(
			validateClusterCreateInput(
				input({ kubeconfig: 'kind: Config\napiVersion: v1\nclusters: one\ncontexts: []' })
			)?.error
		).toBe('Invalid kubeconfig: clusters and contexts must be arrays');
		expect(validateClusterCreateInput(input({ kubeconfig: 'not: [valid' }))?.error).toBe(
			'Invalid kubeconfig format: could not parse as YAML or JSON'
		);
	});
});
