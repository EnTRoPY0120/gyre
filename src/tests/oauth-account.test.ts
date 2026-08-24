import { describe, expect, test } from 'vitest';
import { buildOAuthAccountData } from '../lib/server/auth/oauth-account.js';

const now = new Date('2026-01-01T00:00:00.000Z');

describe('buildOAuthAccountData', () => {
	test('encrypts new tokens and computes their expiry from the supplied clock', () => {
		const data = buildOAuthAccountData(
			'user-1',
			'github',
			'provider-user-1',
			{
				accessToken: 'access',
				refreshToken: 'refresh',
				idToken: 'id',
				expiresIn: 3600,
				scope: 'read:user'
			},
			undefined,
			now
		);

		expect(data).toMatchObject({
			userId: 'user-1',
			providerId: 'github',
			accountId: 'provider-user-1',
			accessTokenExpiresAt: new Date('2026-01-01T01:00:00.000Z'),
			scope: 'read:user',
			lastLoginAt: now
		});
		expect(data.accessTokenEncrypted).not.toBe('access');
		expect(data.refreshTokenEncrypted).not.toBe('refresh');
		expect(data.idTokenEncrypted).not.toBe('id');
	});

	test('preserves stored encrypted values when a refresh omits tokens', () => {
		const existingAccount = {
			accessTokenExpiresAt: new Date('2026-01-02T00:00:00.000Z'),
			scope: 'openid',
			accessTokenEncrypted: 'encrypted-access',
			refreshTokenEncrypted: 'encrypted-refresh',
			idTokenEncrypted: 'encrypted-id'
		};

		expect(
			buildOAuthAccountData('user-1', 'oidc', 'subject-1', undefined, existingAccount, now)
		).toMatchObject({
			accessTokenExpiresAt: existingAccount.accessTokenExpiresAt,
			scope: 'openid',
			accessTokenEncrypted: 'encrypted-access',
			refreshTokenEncrypted: 'encrypted-refresh',
			idTokenEncrypted: 'encrypted-id',
			lastLoginAt: now
		});
	});
});
