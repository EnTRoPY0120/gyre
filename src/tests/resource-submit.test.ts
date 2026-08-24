import { describe, expect, test, vi } from 'vitest';
import { createResourceFromWizard } from '../lib/components/wizards/resource-submit.js';

describe('createResourceFromWizard', () => {
	test('sends the manifest and CSRF token and returns created metadata', async () => {
		const fetcher = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ metadata: { namespace: 'apps', name: 'demo' } }), {
				status: 201
			})
		);
		const manifest = { apiVersion: 'v1', kind: 'Demo' };

		await expect(
			createResourceFromWizard('demos', manifest, 'csrf-token', fetcher)
		).resolves.toEqual({
			metadata: { namespace: 'apps', name: 'demo' }
		});
		expect(fetcher).toHaveBeenCalledWith('/api/v1/flux/demos', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'csrf-token' },
			body: JSON.stringify(manifest)
		});
	});

	test('uses the API message and a stable fallback for failed responses', async () => {
		await expect(
			createResourceFromWizard(
				'demos',
				{},
				'csrf-token',
				vi
					.fn()
					.mockResolvedValue(
						new Response(JSON.stringify({ message: 'Name already exists' }), { status: 409 })
					)
			)
		).rejects.toThrow('Name already exists');

		await expect(
			createResourceFromWizard(
				'demos',
				{},
				'csrf-token',
				vi.fn().mockResolvedValue(new Response('failure', { status: 500 }))
			)
		).rejects.toThrow('Failed to create resource');
	});
});
