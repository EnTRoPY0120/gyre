import { describe, expect, test } from 'vitest';
import { createEmptyAuthProviderFormData } from '../lib/components/admin/auth-provider.js';
import { buildAuthProviderUpdates } from '../routes/admin/auth-providers/form-helpers.js';

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
