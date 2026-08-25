import { describe, expect, test } from 'vitest';
import {
	createSSOAccountRecord,
	createSSOUserRecord,
	getProvisioningAccessReason,
	isAllowedDomain
} from '../lib/server/auth/sso-provisioning-helpers.js';
import { createOAuthProviderConfig } from './helpers/oauth-provider-mocks.js';
import type { AuthProvider } from '../lib/server/db/schema.js';

const provider = createOAuthProviderConfig() as AuthProvider;
const userInfo = {
	sub: 'provider-user-1',
	name: 'A User',
	picture: 'https://example.com/avatar.png',
	emailVerified: true
};

describe('SSO provisioning helpers', () => {
	test('matches allowlisted email domains case-insensitively', () => {
		expect(isAllowedDomain('person@Example.com', [' example.com '])).toBe(true);
		expect(isAllowedDomain('person@other.com', ['example.com'])).toBe(false);
		expect(isAllowedDomain(undefined, [])).toBe(true);
	});

	test('reports provisioning access restrictions in priority order', () => {
		expect(
			getProvisioningAccessReason(
				{ allowSignup: false, domainAllowlist: [] },
				provider,
				'a@example.com'
			)
		).toBe('signup_disabled');
		expect(
			getProvisioningAccessReason(
				{ allowSignup: true, domainAllowlist: [] },
				{ ...provider, autoProvision: false },
				'a@example.com'
			)
		).toBe('auto_provision_disabled');
		expect(
			getProvisioningAccessReason(
				{ allowSignup: true, domainAllowlist: ['example.com'] },
				provider,
				'a@other.com'
			)
		).toBe('domain_not_allowed');
		expect(
			getProvisioningAccessReason(
				{ allowSignup: true, domainAllowlist: [] },
				provider,
				'a@example.com'
			)
		).toBeUndefined();
	});

	test('builds local user and encrypted account records', () => {
		const user = createSSOUserRecord('user-1', 'a-user', undefined, userInfo, 'viewer');
		expect(user).toMatchObject({
			id: 'user-1',
			username: 'a-user',
			name: 'A User',
			email: null,
			isLocal: false,
			emailVerified: true
		});

		const account = createSSOAccountRecord('user-1', 'provider-1', userInfo, {
			accessToken: 'access-token',
			refreshToken: 'refresh-token',
			tokenType: 'Bearer',
			scope: 'openid'
		});
		expect(account).toMatchObject({
			userId: 'user-1',
			providerId: 'provider-1',
			accountId: 'provider-user-1',
			accessToken: null,
			refreshTokenEncrypted: expect.any(String)
		});
		expect(account.refreshTokenEncrypted).not.toBe('refresh-token');
	});
});
