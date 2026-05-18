import { afterEach, beforeEach, describe, test, expect, vi } from 'vitest';
import { expectOAuthErrorCode } from './helpers/oauth.js';
import { importFresh } from './helpers/import-fresh';
import { createAuthCryptoModuleStub } from './helpers/module-stubs';

type GoogleProviderModule = typeof import('../lib/server/auth/oauth/providers/google.js');

vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

let arcticShouldThrow = false;

let mockJwtClaims: Record<string, unknown> = {
	sub: '123',
	email: 'user@google.com',
	email_verified: true,
	name: 'Test User',
	preferred_username: 'user@google.com'
};

let GoogleProvider: GoogleProviderModule['GoogleProvider'];

beforeEach(async () => {
	arcticShouldThrow = false;
	mockJwtClaims = {
		sub: '123',
		email: 'user@google.com',
		email_verified: true,
		name: 'Test User',
		preferred_username: 'user@google.com'
	};

	vi.doMock('$lib/server/auth/crypto', () => createAuthCryptoModuleStub());

	vi.doMock('arctic', () => ({
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
		},
		GitHub: class MockGitHub {
			createAuthorizationURL(state: string, scopes: string[]) {
				return new URL(
					`https://github.com/login/oauth/authorize?state=${state}&scope=${scopes.join(',')}`
				);
			}
			async validateAuthorizationCode() {
				return {
					accessToken: () => 'arctic-access-token',
					hasScopes: () => true,
					scopes: () => ['read:user', 'user:email'],
					accessTokenExpiresAt: () => null
				};
			}
		},
		GitLab: class MockGitLab {
			constructor(
				public baseURL: string,
				public clientId: string,
				_clientSecret: string,
				_redirectUri: string
			) {}
			async createAuthorizationURL(state: string, scopes: string[]) {
				return new URL(`${this.baseURL}/oauth/authorize?state=${state}&scope=${scopes.join(',')}`);
			}
			async validateAuthorizationCode() {
				return {
					accessToken: () => 'arctic-access-token',
					hasRefreshToken: () => false,
					refreshToken: () => undefined,
					accessTokenExpiresAt: () => null
				};
			}
		}
	}));

	vi.doMock('jose', () => ({
		createRemoteJWKSet: () => 'mock-jwks',
		jwtVerify: async () => ({ payload: {}, protectedHeader: {} }),
		decodeJwt: () => mockJwtClaims
	}));

	GoogleProvider = (
		await importFresh<GoogleProviderModule>('../lib/server/auth/oauth/providers/google.js')
	).GoogleProvider;
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.resetModules();
});

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
			await expectOAuthErrorCode(provider.validateCallback('bad-code'), 'TOKEN_EXCHANGE_FAILED');
		} finally {
			arcticShouldThrow = false;
		}
	});
});

// ---------------------------------------------------------------------------
// getUserInfo
// ---------------------------------------------------------------------------

describe('GoogleProvider.getUserInfo()', () => {
	test('delegates to OIDCProvider and returns userInfo', async () => {
		mockJwtClaims = {
			sub: '123',
			email: 'user@google.com',
			email_verified: true,
			name: 'Test User',
			preferred_username: 'user@google.com'
		};

		const provider = makeProvider();
		const info = await provider.getUserInfo({
			accessToken: 'token',
			tokenType: 'Bearer',
			idToken: 'mock-id-token'
		});
		expect(info.sub).toBe('123');
		expect(info.email).toBe('user@google.com');
		expect(info.name).toBe('Test User');
	});

	test('adds domain:<hd> to groups when hd claim is present', async () => {
		mockJwtClaims = {
			sub: '123',
			email: 'user@company.com',
			email_verified: true,
			name: 'Test User',
			preferred_username: 'user@company.com',
			hd: 'company.com'
		};

		const provider = makeProvider();
		const info = await provider.getUserInfo({
			accessToken: 'token',
			tokenType: 'Bearer',
			idToken: 'mock-id-token'
		});
		expect(info.groups).toContain('domain:company.com');
	});

	test('does not modify groups when hd claim is absent', async () => {
		mockJwtClaims = {
			sub: '123',
			email: 'user@example.com',
			email_verified: true,
			name: 'Test User',
			preferred_username: 'user@example.com'
		};

		const provider = makeProvider();
		const info = await provider.getUserInfo({
			accessToken: 'token',
			tokenType: 'Bearer',
			idToken: 'mock-id-token'
		});
		expect(info.groups).toBeUndefined();
	});

	test('throws OAuthError with USERINFO_FAILED when OIDCProvider throws', async () => {
		const provider = makeProvider();
		// Without idToken and without discovery mocked, OIDCProvider calls discover() → fetch throws
		const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
			throw new Error('Network error');
		});
		try {
			await expectOAuthErrorCode(
				provider.getUserInfo({ accessToken: 'bad-token', tokenType: 'Bearer' }),
				'USERINFO_FAILED'
			);
		} finally {
			spy.mockRestore();
		}
	});
});
