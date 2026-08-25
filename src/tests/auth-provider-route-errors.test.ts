import { describe, expect, test } from 'vitest';
import { error } from '@sveltejs/kit';
import { handleAuthProviderLoadError } from '../routes/api/v1/admin/auth-providers/auth-provider-route-errors.js';

describe('auth provider route error boundary', () => {
	test('converts unexpected failures to a safe 500 error', () => {
		expect(() => handleAuthProviderLoadError(new Error('database unavailable'))).toThrow(
			expect.objectContaining({ status: 500, body: { message: 'Failed to load provider' } })
		);
	});

	test('preserves framework HTTP errors', () => {
		let notFound: unknown;
		try {
			error(404, { message: 'Provider not found' });
		} catch (caught) {
			notFound = caught;
		}

		let handled: unknown;
		try {
			handleAuthProviderLoadError(notFound);
		} catch (caught) {
			handled = caught;
		}

		expect(handled).toBe(notFound);
	});
});
