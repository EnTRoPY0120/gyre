import { describe, expect, test, vi } from 'vitest';
import { submitPasswordChange } from '../lib/auth/password-change-flow.js';

describe('submitPasswordChange', () => {
	test('sends only the server-owned password fields with the CSRF token', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));

		await submitPasswordChange(
			{ currentPassword: 'CurrentPassword123!', newPassword: 'NewPassword123!' },
			'csrf-token',
			fetcher
		);

		expect(fetcher).toHaveBeenCalledWith('/api/v1/auth/change-password', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'csrf-token' },
			body: JSON.stringify({
				currentPassword: 'CurrentPassword123!',
				newPassword: 'NewPassword123!'
			})
		});
	});

	test('preserves structured API errors and falls back for malformed failures', async () => {
		await expect(
			submitPasswordChange(
				{ currentPassword: 'old', newPassword: 'new' },
				'csrf-token',
				vi.fn().mockResolvedValue(
					new Response(JSON.stringify({ message: { message: 'Current password is incorrect' } }), {
						status: 401
					})
				)
			)
		).rejects.toThrow('Current password is incorrect');

		await expect(
			submitPasswordChange(
				{ currentPassword: 'old', newPassword: 'new' },
				'csrf-token',
				vi.fn().mockResolvedValue(new Response('not-json', { status: 500 }))
			)
		).rejects.toThrow('Failed to change password');
	});
});
