import { describe, expect, test } from 'vitest';
import {
	validatePasswordResetInput,
	validateUserCreateInput,
	validateUserUpdateInput
} from '../routes/admin/users/action-validation.js';

const strongPassword = 'Str0ng!Password';

describe('admin user action validation', () => {
	test('validates user creation fields', () => {
		expect(validateUserCreateInput('', '', '', '')).toBe(
			'Username, password, and role are required'
		);
		expect(validateUserCreateInput('ab', '', strongPassword, 'viewer')).toBe(
			'Username must be at least 3 characters'
		);
		expect(validateUserCreateInput('alice', 'invalid', strongPassword, 'viewer')).toBe(
			'Invalid email format'
		);
		expect(validateUserCreateInput('alice', '', 'weak', 'viewer')).toContain('at least 8');
		expect(validateUserCreateInput('alice', '', strongPassword, 'viewer')).toBeNull();
	});

	test('protects the current admin during updates', () => {
		expect(validateUserUpdateInput('user-1', 'user-1', '', 'viewer', null)).toBe(
			'Cannot remove your own admin role'
		);
		expect(validateUserUpdateInput('user-1', 'user-1', '', null, 'false')).toBe(
			'Cannot deactivate your own account'
		);
		expect(validateUserUpdateInput('user-2', 'user-1', 'bad-email', 'editor', 'true')).toBe(
			'Invalid email format'
		);
		expect(validateUserUpdateInput('user-2', 'user-1', '', 'editor', 'true')).toBeNull();
	});

	test('validates password reset requirements', () => {
		expect(validatePasswordResetInput('', strongPassword)).toBe(
			'User ID and new password are required'
		);
		expect(validatePasswordResetInput('user-2', 'weak')).toContain('at least 8');
		expect(validatePasswordResetInput('user-2', strongPassword)).toBeNull();
	});
});
