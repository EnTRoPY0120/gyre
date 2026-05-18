import { describe, expect, test } from 'vitest';
import {
	generateStrongPassword,
	validateAdminPasswordStrength
} from '../lib/server/auth/passwords.js';

describe('admin password hardening', () => {
	test('weak ADMIN_PASSWORD throws in production', () => {
		expect(() => validateAdminPasswordStrength('admin-password', true)).toThrow(
			'ADMIN_PASSWORD does not meet strength requirements'
		);
	});

	test('weak ADMIN_PASSWORD throws in-cluster', () => {
		expect(() => validateAdminPasswordStrength('admin-password', true)).toThrow(
			'ADMIN_PASSWORD does not meet strength requirements'
		);
	});

	test('weak ADMIN_PASSWORD warns but does not throw in local development', () => {
		expect(() => validateAdminPasswordStrength('admin-password', false)).not.toThrow();
	});

	test('strong ADMIN_PASSWORD is accepted', () => {
		expect(() => validateAdminPasswordStrength('Str0ng!AdminPassword', true)).not.toThrow();
	});

	test('generated admin password path still produces a strong password', () => {
		expect(() => validateAdminPasswordStrength(generateStrongPassword(), true)).not.toThrow();
	});
});
