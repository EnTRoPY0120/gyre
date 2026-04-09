import { afterAll, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';

const consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
const consoleWarnSpy = spyOn(console, 'warn').mockImplementation(() => {});

let arcticShouldThrow = false;
let lastAuthorizationRequest:
	| {
			state: string;
			verifier: string;
			scopes: string[];
	  }
	| undefined;
let lastCallbackVerifier: string | undefined;
let mockJwtClaims: Record<string, unknown> = {};

mock.module('arctic', () => ({
	Google: class MockGoogle {
		createAuthorizationURL(state: string, verifier: string, scopes: string[]) {
			lastAuthorizationRequest = { state, verifier, scopes };
			return new URL(
				`https://accounts.google.com/o/oauth2/auth?state=${state}&verifier=${encodeURIComponent(verifier)}&scope=${scopes.join(',')}`
			);
		}

		async validateAuthorizationCode(_code: string, verifier: string) {
			lastCallbackVerifier = verifier;
			if (arcticShouldThrow) {
				throw new Error('invalid_grant');
			}

			return {
				accessToken: () => 'google-access-token',
				refreshToken: () => 'google-refresh-token',
				idToken: () => 'google-id-token',
				accessTokenExpiresAt: () => null
			};
		}
	}
}));

mock.module('jose', () => ({
	createRemoteJWKSet: () => 'mock-jwks',
	jwtVerify: async () => ({ payload: {}, protectedHeader: {} }),
	decodeJwt: () => mockJwtClaims
}));

import { OAuthError } from '../lib/server/auth/oauth/types.js';
import { _resetKeyCache, encryptSecret } from '../lib/server/auth/crypto.js';
const { GoogleProvider } =
	(await import('../lib/server/auth/oauth/providers/google.js?test=oauth-google')) as typeof import('../lib/server/auth/oauth/providers/google.js');

const baseConfig = {
	id: 'google-1',
	name: 'Google',
	type: 'oauth2-google' as const,
	enabled: true,
	clientId: 'test-client-id',
	clientSecretEncrypted: '',
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
		config: {
			...baseConfig,
			clientSecretEncrypted: encryptSecret('test-client-secret'),
			...overrides
		} as typeof baseConfig,
		redirectUri: 'https://app.example.com/callback'
	});
}

async function expectOAuthError(promise: Promise<unknown>, code: string) {
	try {
		await promise;
		expect.unreachable('expected OAuthError');
	} catch (error) {
		expect(error).toBeInstanceOf(OAuthError);
		expect((error as OAuthError).code).toBe(code);
	}
}

beforeEach(() => {
	process.env.AUTH_ENCRYPTION_KEY = 'b'.repeat(64);
	_resetKeyCache();
	arcticShouldThrow = false;
	lastAuthorizationRequest = undefined;
	lastCallbackVerifier = undefined;
	mockJwtClaims = {
		sub: '123',
		email: 'user@google.com',
		email_verified: true,
		name: 'Test User',
		preferred_username: 'user@google.com'
	};
});

afterAll(() => {
	consoleLogSpy.mockRestore();
	consoleErrorSpy.mockRestore();
	consoleWarnSpy.mockRestore();
	delete process.env.AUTH_ENCRYPTION_KEY;
	_resetKeyCache();
});

describe('GoogleProvider', () => {
	test('rejects missing PKCE verifier when building the authorization URL', async () => {
		await expectOAuthError(makeProvider().getAuthorizationUrl('state-1'), 'MISSING_CODE_VERIFIER');
	});

	test('passes the provided verifier through to the authorization URL builder', async () => {
		const url = await makeProvider({ scopes: '' }).getAuthorizationUrl('state-2', 'verifier-123');

		expect(url.searchParams.get('state')).toBe('state-2');
		expect(lastAuthorizationRequest?.verifier).toBe('verifier-123');
		expect(lastAuthorizationRequest?.scopes).toEqual(
			expect.arrayContaining(['openid', 'profile', 'email'])
		);
	});

	test('rejects missing PKCE verifier during callback validation', async () => {
		await expectOAuthError(makeProvider().validateCallback('auth-code'), 'MISSING_CODE_VERIFIER');
	});

	test('passes the provided verifier to Arctic during callback validation', async () => {
		const tokens = await makeProvider().validateCallback('auth-code', 'verifier-456');

		expect(tokens.accessToken).toBe('google-access-token');
		expect(tokens.idToken).toBe('google-id-token');
		expect(lastCallbackVerifier).toBe('verifier-456');
	});

	test('wraps Arctic token exchange failures', async () => {
		arcticShouldThrow = true;
		await expectOAuthError(
			makeProvider().validateCallback('bad-code', 'verifier-789'),
			'TOKEN_EXCHANGE_FAILED'
		);
	});

	test('adds hosted-domain groups from rawClaims', async () => {
		mockJwtClaims = {
			sub: '123',
			email: 'user@company.com',
			email_verified: true,
			name: 'Test User',
			preferred_username: 'user@company.com',
			hd: 'company.com'
		};

		const userInfo = await makeProvider().getUserInfo({
			accessToken: 'token',
			tokenType: 'Bearer',
			idToken: 'id-token'
		});

		expect(userInfo.groups).toContain('domain:company.com');
		expect(userInfo.rawClaims?.hd).toBe('company.com');
	});

	test('does not add domain group when hd claim is absent', async () => {
		mockJwtClaims = {
			sub: '123',
			email: 'user@gmail.com',
			email_verified: true,
			name: 'Test User',
			preferred_username: 'user@gmail.com'
		};

		const userInfo = await makeProvider().getUserInfo({
			accessToken: 'token',
			tokenType: 'Bearer',
			idToken: 'id-token'
		});

		expect(userInfo.groups?.some((g) => g.startsWith('domain:'))).toBeFalsy();
		expect(userInfo.rawClaims?.hd).toBeUndefined();
	});

	test('does not add a domain group for whitespace-only hd values', async () => {
		mockJwtClaims = {
			sub: '123',
			email: 'user@company.com',
			email_verified: true,
			name: 'Test User',
			preferred_username: 'user@company.com',
			hd: '   '
		};

		const userInfo = await makeProvider().getUserInfo({
			accessToken: 'token',
			tokenType: 'Bearer',
			idToken: 'id-token'
		});

		expect(userInfo.groups?.some((g) => g.startsWith('domain:'))).toBeFalsy();
	});
});
