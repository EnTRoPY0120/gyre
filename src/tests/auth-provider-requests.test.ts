import { describe, expect, test, vi } from 'vitest';
import { createEmptyAuthProviderFormData } from '../lib/components/admin/auth-provider.js';
import { updateAuthProvider } from '../routes/admin/auth-providers/auth-provider-requests.js';

describe('updateAuthProvider', () => {
	test('submits the edit payload without replacing a blank client secret', async () => {
		const formData = createEmptyAuthProviderFormData();
		formData.name = 'Corp SSO';
		const request = vi.fn().mockResolvedValue(undefined);

		await updateAuthProvider('provider-1', formData, request);

		expect(request).toHaveBeenCalledWith(
			'/api/v1/admin/auth-providers/provider-1',
			expect.objectContaining({ method: 'PATCH', headers: { 'Content-Type': 'application/json' } }),
			'Failed to update provider'
		);
		const options = request.mock.calls[0]?.[1] as RequestInit;
		expect(JSON.parse(options.body as string)).not.toHaveProperty('clientSecret');
	});

	test('normalizes a custom role mapping before submitting it', async () => {
		const formData = createEmptyAuthProviderFormData();
		formData.roleMapping = '{"admin":["platform-admin"]}';
		formData.clientSecret = 'new-secret';
		const request = vi.fn().mockResolvedValue(undefined);

		await updateAuthProvider('provider-1', formData, request);

		const options = request.mock.calls[0]?.[1] as RequestInit;
		expect(JSON.parse(options.body as string)).toMatchObject({
			clientSecret: 'new-secret',
			roleMapping: { admin: ['platform-admin'] }
		});
	});
});
