import { describe, expect, test } from 'vitest';
import { validatePasswordChangeInput } from '../routes/api/v1/auth/change-password/validation.js';

describe('validatePasswordChangeInput', () => {
	test('accepts two non-empty password strings', () => {
		expect(validatePasswordChangeInput('Current123!', 'New123!Password')).toBeNull();
	});

	test('rejects missing or non-string password values', () => {
		expect(validatePasswordChangeInput('', 'New123!Password')).toBe(
			'Current password and new password are required'
		);
		expect(validatePasswordChangeInput('Current123!', null)).toBe(
			'Current password and new password are required'
		);
		expect(validatePasswordChangeInput(42, 'New123!Password')).toBe(
			'Current password and new password are required'
		);
	});
});
