import { describe, expect, test, vi } from 'vitest';
import {
	getResourceUpdateError,
	saveResourceEdit,
	updateResource,
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

describe('updateResource', () => {
	test('sends an encoded PUT request with the resource YAML and CSRF token', async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));

		await updateResource({
			resourceType: 'git repositories',
			namespace: 'flux system',
			name: 'source/app',
			yamlContent: validYaml,
			csrfToken: 'csrf-token',
			fetcher
		});

		expect(fetcher).toHaveBeenCalledWith(
			'/api/v1/flux/git%20repositories/flux%20system/source%2Fapp',
			expect.objectContaining({
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'X-CSRF-Token': 'csrf-token'
				},
				body: JSON.stringify({ yaml: validYaml })
			})
		);
	});

	test('throws the endpoint error for an unsuccessful response', async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(JSON.stringify({ error: 'Update rejected' }), {
				status: 422,
				statusText: 'Unprocessable Entity'
			})
		);

		await expect(
			updateResource({
				resourceType: 'gitrepositories',
				namespace: 'flux-system',
				name: 'source',
				yamlContent: validYaml,
				csrfToken: 'csrf-token',
				fetcher
			})
		).rejects.toThrow('Update rejected');
	});
});

describe('saveResourceEdit', () => {
	test('rejects invalid resource content without invoking the updater', async () => {
		const updater = vi.fn();

		await expect(
			saveResourceEdit({
				resourceType: 'gitrepositories',
				namespace: 'flux-system',
				name: 'source',
				yamlContent: 'kind: GitRepository',
				csrfToken: 'csrf-token',
				validationErrors: [],
				afterSave: vi.fn(),
				updater
			})
		).resolves.toBe('Invalid resource: missing required fields (apiVersion, kind, metadata)');
		expect(updater).not.toHaveBeenCalled();
	});

	test('blocks saves while Monaco reports YAML syntax errors', async () => {
		const updater = vi.fn();

		await expect(
			saveResourceEdit({
				resourceType: 'gitrepositories',
				namespace: 'flux-system',
				name: 'source',
				yamlContent: validYaml,
				csrfToken: 'csrf-token',
				validationErrors: [{ severity: 8 }],
				afterSave: vi.fn(),
				updater
			})
		).resolves.toBe('Please fix YAML syntax errors before saving');
		expect(updater).not.toHaveBeenCalled();
	});

	test('runs the successful-save lifecycle after updating the resource', async () => {
		const updater = vi.fn().mockResolvedValue(undefined);
		const afterSave = vi.fn().mockResolvedValue(undefined);

		await expect(
			saveResourceEdit({
				resourceType: 'gitrepositories',
				namespace: 'flux-system',
				name: 'source',
				yamlContent: validYaml,
				csrfToken: 'csrf-token',
				validationErrors: [],
				afterSave,
				updater
			})
		).resolves.toBeNull();
		expect(updater).toHaveBeenCalledWith({
			resourceType: 'gitrepositories',
			namespace: 'flux-system',
			name: 'source',
			yamlContent: validYaml,
			csrfToken: 'csrf-token'
		});
		expect(afterSave).toHaveBeenCalledOnce();
	});
});
