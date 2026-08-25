import { describe, expect, test } from 'vitest';
import { createEmptyAuthProviderFormData } from '../lib/components/admin/auth-provider.js';
import {
	buildAuthProviderCreateBody,
	buildAuthProviderUpdates,
	normalizeRoleMappingForSave
} from '../routes/admin/auth-providers/form-helpers.js';
import { DEFAULT_ROLE_MAPPING_TEMPLATE } from '../lib/auth/role-mapping.js';

describe('buildAuthProviderUpdates', () => {
	test('does not clear an existing client secret when the edit form leaves it blank', () => {
		const formData = createEmptyAuthProviderFormData();
		formData.name = 'Corp SSO';

		expect(buildAuthProviderUpdates(formData, null)).not.toHaveProperty('clientSecret');
	});

	test('includes a newly entered client secret and normalized role mapping', () => {
		const formData = createEmptyAuthProviderFormData();
		formData.clientSecret = 'new-secret';
		const roleMapping = { admin: ['platform-admin'] };

		expect(buildAuthProviderUpdates(formData, roleMapping)).toMatchObject({
			clientSecret: 'new-secret',
			roleMapping
		});
	});
});

describe('buildAuthProviderCreateBody', () => {
	test('omits role mapping when the form has no custom mapping', () => {
		const formData = createEmptyAuthProviderFormData();
		formData.name = 'Corp SSO';

		expect(buildAuthProviderCreateBody(formData, null)).not.toHaveProperty('roleMapping');
	});

	test('includes a normalized custom role mapping', () => {
		const formData = createEmptyAuthProviderFormData();
		const roleMapping = { admin: ['platform-admin'] };

		expect(buildAuthProviderCreateBody(formData, roleMapping)).toMatchObject({ roleMapping });
	});
});

describe('normalizeRoleMappingForSave', () => {
	test('omits blank and default template mappings', () => {
		expect(normalizeRoleMappingForSave('')).toBeNull();
		expect(normalizeRoleMappingForSave(DEFAULT_ROLE_MAPPING_TEMPLATE)).toBeNull();
	});

	test('preserves non-empty role mappings for submission', () => {
		expect(normalizeRoleMappingForSave('{"admin":["platform-admin"]}')).toEqual({
			admin: ['platform-admin']
		});
	});

	test('fails closed for malformed and empty mappings', () => {
		expect(normalizeRoleMappingForSave('{invalid')).toBeNull();
		expect(normalizeRoleMappingForSave('{"admin":[]}')).toBeNull();
	});
});
