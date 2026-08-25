import { describe, expect, test } from 'vitest';
import {
	DEFAULT_ROLE_MAPPING_TEMPLATE,
	parseRoleMappingInput,
	stringifyRoleMappingForForm
} from '../lib/auth/role-mapping.js';
import { mapRoleFromGroups } from '../lib/server/auth/role-mapping.js';

describe('parseRoleMappingInput', () => {
	test('accepts object input', () => {
		expect(parseRoleMappingInput({ admin: ['platform-admins'], viewer: [] })).toEqual({
			admin: ['platform-admins'],
			viewer: []
		});
	});

	test('accepts JSON string input', () => {
		expect(parseRoleMappingInput('{"editor":["team-a"],"viewer":[]}')).toEqual({
			editor: ['team-a'],
			viewer: []
		});
	});

	test('treats blank input as null', () => {
		expect(parseRoleMappingInput('   ')).toBeNull();
		expect(parseRoleMappingInput(null)).toBeNull();
	});

	test('rejects malformed JSON strings', () => {
		expect(() => parseRoleMappingInput('{"admin":')).toThrow('Role mapping must be valid JSON');
	});

	test('rejects non-string-array values', () => {
		expect(() => parseRoleMappingInput({ admin: ['ok'], viewer: [1] })).toThrow(
			'roleMapping must be an object mapping role names to arrays of group strings'
		);
	});

	test('rejects non-plain objects', () => {
		expect(() => parseRoleMappingInput(new Date())).toThrow(
			'roleMapping must be an object mapping role names to arrays of group strings'
		);
	});
});

describe('stringifyRoleMappingForForm', () => {
	test('pretty-prints object input for the textarea', () => {
		expect(stringifyRoleMappingForForm({ admin: ['platform-admins'], viewer: [] })).toBe(
			'{\n  "admin": [\n    "platform-admins"\n  ],\n  "viewer": []\n}'
		);
	});

	test('falls back to the default template when parsing fails', () => {
		expect(stringifyRoleMappingForForm(42)).toBe(DEFAULT_ROLE_MAPPING_TEMPLATE);
	});
});

describe('mapRoleFromGroups', () => {
	test('restricts unsafe and unknown default roles', () => {
		expect(mapRoleFromGroups([], null, 'admin')).toBe('editor');
		expect(mapRoleFromGroups([], null, 'unknown')).toBe('viewer');
		expect(mapRoleFromGroups([], null, 'EDITOR')).toBe('editor');
	});

	test('uses the highest-priority matching group mapping', () => {
		const mapping = JSON.stringify({
			admin: ['platform-admins'],
			editor: ['developers'],
			viewer: ['auditors']
		});

		expect(mapRoleFromGroups(['auditors'], mapping, 'viewer')).toBe('viewer');
		expect(mapRoleFromGroups(['developers'], mapping, 'viewer')).toBe('editor');
		expect(mapRoleFromGroups(['developers', 'platform-admins'], mapping, 'viewer')).toBe('admin');
	});

	test('falls back safely when the role mapping is malformed or empty', () => {
		expect(mapRoleFromGroups(['platform-admins'], '{invalid', 'editor')).toBe('editor');
		expect(mapRoleFromGroups(['platform-admins'], 'null', 'viewer')).toBe('viewer');
	});
});
