import { describe, expect, test } from 'vitest';
import { normalizeRoleMapping } from '../lib/server/auth/seed-provider-helpers.js';

describe('normalizeRoleMapping', () => {
	test('normalizes object and JSON-string mappings', () => {
		expect(normalizeRoleMapping('Corp', null)).toBeNull();
		expect(normalizeRoleMapping('Corp', { admin: ['Platform'] })).toBe('{"admin":["Platform"]}');
		expect(normalizeRoleMapping('Corp', '{"viewer":["Readers"]}')).toBe('{"viewer":["Readers"]}');
	});

	test('rejects malformed and unsafe mappings with provider context', () => {
		expect(() => normalizeRoleMapping('Corp', '{bad-json')).toThrow(
			'Provider "Corp" has invalid roleMapping: not valid JSON'
		);
		expect(() => normalizeRoleMapping('Corp', '[]')).toThrow(
			'Provider "Corp" has invalid roleMapping: must be a JSON object'
		);
		expect(() => normalizeRoleMapping('Corp', '{"admin":[1]}')).toThrow(
			'Provider "Corp" has invalid roleMapping: values must be string[] for key "admin"'
		);
	});
});
