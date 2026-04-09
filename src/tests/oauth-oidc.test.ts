import { afterAll, afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';

let consoleLogSpy: ReturnType<typeof spyOn>;
let consoleErrorSpy: ReturnType<typeof spyOn>;
let consoleWarnSpy: ReturnType<typeof spyOn>;

let mockJwtClaims: Record<string, unknown> = {};
let mockJwtVerifyImpl: (...args: unknown[]) => Promise<unknown> = async () => ({
	payload: {},
	protectedHeader: {}
});

mock.module('../lib/server/auth/pkce.js', () => ({
	generateCodeChallenge: (value: string) => `challenge_${value}`
}));

mock.module('jose', () => ({
	createRemoteJWKSet: () => 'mock-jwks',
	jwtVerify: (...args: unknown[]) => mockJwtVerifyImpl(...args),
	decodeJwt: () => mockJwtClaims
}));

import { OAuthError } from '../lib/server/auth/oauth/types.js';
import { _resetKeyCache, encryptSecret } from '../lib/server/auth/crypto.js';
const { OIDCProvider } =
	(await import('../lib/server/auth/oauth/providers/oidc.js?test=oauth-oidc')) as typeof import('../lib/server/auth/oauth/providers/oidc.js');
mock.restore();

const BASE_DISCOVERY = {
	issuer: 'https://provider.example.com',
	authorization_endpoint: 'https://provider.example.com/auth',
	token_endpoint: 'https://provider.example.com/token',
	jwks_uri: 'https://provider.example.com/.well-known/jwks',
	userinfo_endpoint: 'https://provider.example.com/userinfo',
	response_types_supported: ['code'],
	subject_types_supported: ['public'],
	id_token_signing_alg_values_supported: ['RS256']
};

const baseConfig = {
	id: 'oidc-1',
	name: 'Test OIDC',
	type: 'oidc' as const,
	enabled: true,
	clientId: 'test-client-id',
	clientSecretEncrypted: '',
	issuerUrl: 'https://provider.example.com',
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

function makeProvider(configOverrides: Partial<typeof baseConfig> = {}) {
	return new OIDCProvider({
		config: {
			...baseConfig,
			clientSecretEncrypted: encryptSecret('test-client-secret'),
			...configOverrides
		} as never,
		redirectUri: 'https://app.example.com/callback'
	});
}

function mockOidcFetch(options: {
	issuerUrl?: string;
	tokenResponse?: Record<string, unknown>;
	userinfoResponse?: Record<string, unknown>;
}) {
	const issuerUrl = options.issuerUrl ?? baseConfig.issuerUrl;
	const discovery = {
		...BASE_DISCOVERY,
		issuer: issuerUrl,
		authorization_endpoint: `${issuerUrl}/auth`,
		token_endpoint: `${issuerUrl}/token`,
		jwks_uri: `${issuerUrl}/.well-known/jwks`,
		userinfo_endpoint: `${issuerUrl}/userinfo`
	};

	return spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
		const urlStr = url.toString();

		if (urlStr.includes('.well-known/openid-configuration')) {
			return new Response(JSON.stringify(discovery), { status: 200 });
		}

		if (urlStr.endsWith('/token')) {
			return new Response(
				JSON.stringify({
					access_token: 'access-token',
					token_type: 'Bearer',
					...options.tokenResponse
				}),
				{ status: 200 }
			);
		}

		if (urlStr.endsWith('/userinfo')) {
			return new Response(JSON.stringify(options.userinfoResponse ?? { sub: 'user-123' }), {
				status: 200
			});
		}

		return new Response('not found', { status: 404 });
	});
}

async function expectOAuthError(promise: Promise<unknown>, code: string) {
	try {
		await promise;
		throw new Error('expected OAuthError');
	} catch (error) {
		if (!(error instanceof OAuthError)) {
			throw error;
		}

		expect(error).toBeInstanceOf(OAuthError);
		expect(error.code).toBe(code);
		return error;
	}
}

beforeEach(() => {
	process.env.AUTH_ENCRYPTION_KEY = 'a'.repeat(64);
	_resetKeyCache();
	consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
	consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
	consoleWarnSpy = spyOn(console, 'warn').mockImplementation(() => {});
	mockJwtClaims = {};
	mockJwtVerifyImpl = async () => ({ payload: {}, protectedHeader: {} });
});

afterEach(() => {
	consoleLogSpy.mockRestore();
	consoleErrorSpy.mockRestore();
	consoleWarnSpy.mockRestore();
});

afterAll(() => {
	delete process.env.AUTH_ENCRYPTION_KEY;
	_resetKeyCache();
});

describe('OIDCProvider', () => {
	test('throws INVALID_CONFIG when issuerUrl is missing', () => {
		try {
			makeProvider({ issuerUrl: null as never });
			expect.unreachable('expected constructor to throw');
		} catch (error) {
			expect(error).toBeInstanceOf(OAuthError);
			expect((error as OAuthError).code).toBe('INVALID_CONFIG');
		}
	});

	test('normalizes string role claims to groups while preserving rawClaims', async () => {
		mockJwtClaims = {
			sub: 'user-123',
			email: 'user@example.com',
			email_verified: true,
			name: 'Test User',
			preferred_username: 'testuser',
			groups: 'platform-admins',
			department: 'platform'
		};

		const provider = makeProvider();
		const userInfo = await provider.getUserInfo({
			accessToken: 'access-token',
			tokenType: 'Bearer',
			idToken: 'id-token'
		});

		expect(userInfo.groups).toEqual(['platform-admins']);
		expect(userInfo.rawClaims?.groups).toBe('platform-admins');
		expect(userInfo.department).toBe('platform');
	});

	test('does not leak standard snake_case claims into passthrough fields', async () => {
		mockJwtClaims = {
			sub: 'user-123',
			email: 'user@example.com',
			email_verified: true,
			name: 'Test User',
			preferred_username: 'testuser',
			given_name: 'Test',
			family_name: 'User',
			locale: 'en',
			department: 'platform'
		};

		const provider = makeProvider();
		const userInfo = await provider.getUserInfo({
			accessToken: 'access-token',
			tokenType: 'Bearer',
			idToken: 'id-token'
		});

		expect(userInfo.emailVerified).toBe(true);
		expect(userInfo.givenName).toBe('Test');
		expect(userInfo.familyName).toBe('User');
		expect(userInfo).not.toHaveProperty('email_verified');
		expect(userInfo).not.toHaveProperty('given_name');
		expect(userInfo).not.toHaveProperty('family_name');
		expect(userInfo.department).toBe('platform');
	});

	test.each([
		['issuer', 'unexpected "iss" claim value'],
		['audience', 'unexpected "aud" claim value'],
		['signature', 'signature verification failed']
	])('rejects callback when ID token verification fails for %s', async (scenario, message) => {
		const issuerUrl = `https://${scenario}.example.com`;
		const fetchSpy = mockOidcFetch({
			issuerUrl,
			tokenResponse: { id_token: `bad-${scenario}-token` }
		});
		mockJwtVerifyImpl = async () => {
			throw new Error(message);
		};

		try {
			const provider = makeProvider({ issuerUrl });
			const error = await expectOAuthError(
				provider.validateCallback('auth-code', 'verifier-123'),
				'INVALID_ID_TOKEN'
			);
			expect(error.message).toContain('ID token validation failed');
		} finally {
			fetchSpy.mockRestore();
		}
	});
});
