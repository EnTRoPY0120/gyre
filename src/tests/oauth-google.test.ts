import { describe, test, expect, mock, spyOn } from 'bun:test';

spyOn(console, 'log').mockImplementation(() => {});
spyOn(console, 'error').mockImplementation(() => {});
spyOn(console, 'warn').mockImplementation(() => {});

mock.module('../lib/server/auth/crypto.js', () => ({
	decryptSecret: (s: string) => `decrypted_${s}`
}));

let arcticShouldThrow = false;

mock.module('arctic', () => ({
	Google: class MockGoogle {
		createAuthorizationURL(state: string, verifier: string, scopes: string[]) {
			return new URL(
				`https://accounts.google.com/o/oauth2/auth?state=${state}&verifier=${encodeURIComponent(verifier)}&scope=${scopes.join(',')}`
			);
		}
		async validateAuthorizationCode(_code: string, _verifier: string) {
			if (arcticShouldThrow) throw new Error('invalid_grant');
			return {
				accessToken: () => 'google-access-token',
				refreshToken: () => 'google-refresh-token',
				idToken: () => 'google-id-token',
				accessTokenExpiresAt: () => null
			};
		}
	}
}));

// IMPORTANT: Mock OIDCProvider BEFORE importing GoogleProvider
const mockGetUserInfo = mock(async () => ({
	sub: '123',
	email: 'user@google.com',
	emailVerified: true,
	username: 'user@google.com',
	name: 'Test User',
	groups: [] as string[]
}));

mock.module('../lib/server/auth/oauth/providers/oidc.js', () => ({
	OIDCProvider: class MockOIDCProvider {
		constructor() {}
		getUserInfo = mockGetUserInfo;
	}
}));

import { GoogleProvider } from '../lib/server/auth/oauth/providers/google.js';

const mockConfig = {
	id: 'google-1',
	name: 'Google',
	type: 'oauth2-google' as const,
	enabled: true,
	clientId: 'test-client-id',
	clientSecretEncrypted: 'encrypted-secret',
	issuerUrl: 'https://accounts.google.com',
	authorizationUrl: null,
	tokenUrl: null,
	userInfoUrl: null,
	jwksUrl: null,
	autoProvision: true,
	defaultRole: 'viewer' as const,
	roleMapping: null as string | null,
	roleClaim: 'groups',
	usernameClaim: 'preferred_username',
	emailClaim: 'email',
	usePkce: true,
	scopes: 'openid profile email',
	createdAt: new Date(),
	updatedAt: new Date()
};

function makeProvider(overrides: Record<string, unknown> = {}) {
	return new GoogleProvider({
		config: { ...mockConfig, ...overrides } as typeof mockConfig,
		redirectUri: 'https://app.example.com/callback'
	});
}

// ---------------------------------------------------------------------------
// getAuthorizationUrl
// ---------------------------------------------------------------------------

describe('GoogleProvider.getAuthorizationUrl()', () => {
	test('includes state param in returned URL', async () => {
		const provider = makeProvider();
		const url = await provider.getAuthorizationUrl('test-state-xyz');
		expect(url.searchParams.get('state')).toBe('test-state-xyz');
	});

	test('uses empty string verifier when no codeVerifier provided (PKCE always enabled)', async () => {
		const provider = makeProvider();
		const url = await provider.getAuthorizationUrl('state-1');
		// verifier is '' (encoded as empty string in URL)
		expect(url.searchParams.get('verifier')).toBe('');
	});

	test('uses provided codeVerifier in PKCE verifier param', async () => {
		const provider = makeProvider();
		const url = await provider.getAuthorizationUrl('state-2', 'my-verifier');
		expect(url.searchParams.get('verifier')).toBe('my-verifier');
	});

	test('injects required scopes (openid, profile, email) even if missing from config.scopes', async () => {
		const provider = makeProvider({ scopes: '' });
		const url = await provider.getAuthorizationUrl('state-3');
		const scope = url.searchParams.get('scope') ?? '';
		expect(scope).toContain('openid');
		expect(scope).toContain('profile');
		expect(scope).toContain('email');
	});

	test('does not duplicate required scopes already present in config.scopes', async () => {
		const provider = makeProvider({ scopes: 'openid profile email' });
		const url = await provider.getAuthorizationUrl('state-4');
		const scope = url.searchParams.get('scope') ?? '';
		const parts = scope.split(',');
		expect(parts.filter((s) => s === 'openid').length).toBe(1);
		expect(parts.filter((s) => s === 'profile').length).toBe(1);
		expect(parts.filter((s) => s === 'email').length).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// validateCallback
// ---------------------------------------------------------------------------

describe('GoogleProvider.validateCallback()', () => {
	test('returns accessToken and idToken from Arctic Google client', async () => {
		const provider = makeProvider();
		const tokens = await provider.validateCallback('auth-code', 'verifier');
		expect(tokens.accessToken).toBe('google-access-token');
		expect(tokens.idToken).toBe('google-id-token');
	});

	test('uses empty string verifier when codeVerifier not provided', async () => {
		const provider = makeProvider();
		const tokens = await provider.validateCallback('auth-code');
		expect(tokens.accessToken).toBe('google-access-token');
	});

	test('throws OAuthError with TOKEN_EXCHANGE_FAILED when Arctic throws', async () => {
		arcticShouldThrow = true;
		try {
			// Create a fresh provider so the Arctic client is initialized fresh
			const provider = makeProvider();
			await expect(provider.validateCallback('bad-code')).rejects.toMatchObject({
				name: 'OAuthError',
				code: 'TOKEN_EXCHANGE_FAILED'
			});
		} finally {
			arcticShouldThrow = false;
		}
	});
});

// ---------------------------------------------------------------------------
// getUserInfo
// ---------------------------------------------------------------------------

describe('GoogleProvider.getUserInfo()', () => {
	test('delegates to OIDCProvider.getUserInfo and returns userInfo', async () => {
		mockGetUserInfo.mockImplementation(async () => ({
			sub: '123',
			email: 'user@google.com',
			emailVerified: true,
			username: 'user@google.com',
			name: 'Test User',
			groups: [] as string[]
		}));

		const provider = makeProvider();
		const info = await provider.getUserInfo({ accessToken: 'token', tokenType: 'Bearer' });
		expect(info.sub).toBe('123');
		expect(info.email).toBe('user@google.com');
		expect(info.name).toBe('Test User');
	});

	test('adds domain:<hd> to groups when hd claim is present', async () => {
		mockGetUserInfo.mockImplementation(async () => ({
			sub: '456',
			email: 'user@company.com',
			emailVerified: true,
			username: 'user@company.com',
			name: 'Corp User',
			groups: [] as string[],
			hd: 'company.com'
		}));

		const provider = makeProvider();
		const info = await provider.getUserInfo({ accessToken: 'token', tokenType: 'Bearer' });
		expect(info.groups).toContain('domain:company.com');
	});

	test('does not modify groups when hd claim is absent', async () => {
		mockGetUserInfo.mockImplementation(async () => ({
			sub: '789',
			email: 'personal@gmail.com',
			emailVerified: true,
			username: 'personal@gmail.com',
			name: 'Personal User',
			groups: [] as string[]
		}));

		const provider = makeProvider();
		const info = await provider.getUserInfo({ accessToken: 'token', tokenType: 'Bearer' });
		expect(info.groups).toEqual([]);
	});

	test('throws OAuthError with USERINFO_FAILED when OIDCProvider throws', async () => {
		mockGetUserInfo.mockImplementation(async () => {
			throw new Error('OIDC failed');
		});

		const provider = makeProvider();
		await expect(
			provider.getUserInfo({ accessToken: 'bad-token', tokenType: 'Bearer' })
		).rejects.toMatchObject({
			name: 'OAuthError',
			code: 'USERINFO_FAILED'
		});
	});
});
