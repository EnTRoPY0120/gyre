import { describe, expect, test } from 'vitest';
import {
	parseUserUpdateInput,
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
		expect(validateUserUpdateInput('user-1', 'user-1', '', null, false)).toBe(
			'Cannot deactivate your own account'
		);
		expect(validateUserUpdateInput('user-2', 'user-1', 'bad-email', 'editor', true)).toBe(
			'Invalid email format'
		);
		expect(validateUserUpdateInput('user-2', 'user-1', '', 'editor', true)).toBeNull();
	});

	test('parses only supported roles and literal active values', () => {
		for (const role of ['admin', 'editor', 'viewer']) {
			const formData = new FormData();
			formData.set('role', role);
			expect(parseUserUpdateInput(formData)).toMatchObject({
				success: true,
				data: { role }
			});
		}

		for (const role of ['owner', 'admin,true', '0']) {
			const formData = new FormData();
			formData.set('role', role);
			expect(parseUserUpdateInput(formData)).toEqual({ success: false, error: 'Invalid role' });
		}

		for (const active of ['true', 'false']) {
			const formData = new FormData();
			formData.set('active', active);
			expect(parseUserUpdateInput(formData)).toMatchObject({
				success: true,
				data: { active: active === 'true' }
			});
		}

		const checked = new FormData();
		checked.append('active', 'true');
		checked.append('active', 'false');
		expect(parseUserUpdateInput(checked)).toMatchObject({
			success: true,
			data: { active: true }
		});

		const malformed = new FormData();
		malformed.set('active', '0');
		expect(parseUserUpdateInput(malformed)).toEqual({
			success: false,
			error: 'Invalid active value'
		});
	});

	test('keeps omitted and empty role fields out of the update', () => {
		const omitted = parseUserUpdateInput(new FormData());
		expect(omitted).toEqual({
			success: true,
			data: { email: '', role: null, active: null }
		});

		const emptyRole = new FormData();
		emptyRole.set('role', '');
		expect(parseUserUpdateInput(emptyRole)).toMatchObject({
			success: true,
			data: { role: null }
		});
	});

	test('rejects uploaded files in update fields', () => {
		for (const field of ['email', 'role', 'active']) {
			const formData = new FormData();
			formData.set(field, new File(['value'], 'value.txt'));
			expect(parseUserUpdateInput(formData)).toMatchObject({ success: false });
		}
	});

	test('validates password reset requirements', () => {
		expect(validatePasswordResetInput('', strongPassword)).toBe(
			'User ID and new password are required'
		);
		expect(validatePasswordResetInput('user-2', 'weak')).toContain('at least 8');
		expect(validatePasswordResetInput('user-2', strongPassword)).toBeNull();
	});
});
