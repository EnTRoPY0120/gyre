import { describe, expect, test } from 'vitest';
import {
	getRequiredFormString,
	requireAdminFormUser,
	serializePagination,
	validateLength
} from '../routes/admin/server-helpers.js';
import { formatEnvironment } from '../routes/admin/page-helpers.js';

describe('admin server helpers', () => {
	test('admin guard returns 403 for missing or non-admin users', () => {
		const missing = requireAdminFormUser({} as App.Locals);
		const viewer = requireAdminFormUser({ user: { role: 'viewer' } } as App.Locals);

		expect('status' in missing && missing.status).toBe(403);
		expect('status' in viewer && viewer.status).toBe(403);
	});

	test('required form string returns 400 with exact message', () => {
		const result = getRequiredFormString(new FormData(), 'name', 'Name is required');
		expect(typeof result).not.toBe('string');
		expect(typeof result !== 'string' && result.status).toBe(400);
		expect(typeof result !== 'string' && result.data.error).toBe('Name is required');
	});

	test('length validation returns exact messages', () => {
		const min = validateLength('ab', {
			min: 3,
			minMessage: 'Too short'
		});
		const max = validateLength('abcd', {
			max: 3,
			maxMessage: 'Too long'
		});

		expect(min?.data.error).toBe('Too short');
		expect(max?.data.error).toBe('Too long');
		expect(validateLength('abc', { min: 3, max: 3 })).toBeNull();
	});

	test('pagination serialization preserves total and pagination fields', () => {
		const result = serializePagination(
			{ users: [{ id: '1' }], total: 1, limit: 10, offset: 0, search: 'a' },
			'users',
			(user: { id: string }) => ({ value: user.id })
		);

		expect(result).toEqual({
			users: [{ value: '1' }],
			total: 1,
			limit: 10,
			offset: 0,
			search: 'a'
		});
	});

	test('formats known environments and preserves unknown values', () => {
		expect(formatEnvironment(undefined)).toBeNull();
		expect(formatEnvironment('development')).toBe('Development');
		expect(formatEnvironment('PRODUCTION')).toBe('Production');
		expect(formatEnvironment('test')).toBe('Test');
		expect(formatEnvironment('staging')).toBe('staging');
	});
});
