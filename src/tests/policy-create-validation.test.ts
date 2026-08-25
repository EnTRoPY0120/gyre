import { describe, expect, test } from 'vitest';
import { validatePolicyCreateInput } from '../routes/admin/policies/create-validation.js';

function input(overrides: Partial<Parameters<typeof validatePolicyCreateInput>[0]> = {}) {
	return {
		name: 'namespace-reader',
		role: 'viewer',
		action: 'read',
		namespacePattern: 'team-*',
		...overrides
	};
}

describe('validatePolicyCreateInput', () => {
	test('accepts valid policy fields', () => {
		expect(validatePolicyCreateInput(input())).toBeNull();
		expect(validatePolicyCreateInput(input({ namespacePattern: '' }))).toBeNull();
	});

	test('validates required fields and name length', () => {
		expect(validatePolicyCreateInput(input({ name: '' }))).toBe(
			'Name, role, and action are required'
		);
		expect(validatePolicyCreateInput(input({ role: '' }))).toBe(
			'Name, role, and action are required'
		);
		expect(validatePolicyCreateInput(input({ name: 'ab' }))).toBe(
			'Policy name must be at least 3 characters'
		);
		expect(validatePolicyCreateInput(input({ name: 'x'.repeat(101) }))).toBe(
			'Policy name must be at most 100 characters'
		);
	});

	test('rejects unsafe namespace patterns', () => {
		expect(validatePolicyCreateInput(input({ namespacePattern: 'Team-*' }))).toBe(
			'Invalid namespace pattern: must contain only lowercase alphanumeric characters, hyphens, and wildcards (* ?)'
		);
		expect(validatePolicyCreateInput(input({ namespacePattern: 'team_1' }))).toContain(
			'Invalid namespace pattern'
		);
	});
});
