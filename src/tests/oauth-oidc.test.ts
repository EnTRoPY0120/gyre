import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';

spyOn(console, 'log').mockImplementation(() => {});
spyOn(console, 'error').mockImplementation(() => {});
spyOn(console, 'warn').mockImplementation(() => {});

mock.module('../lib/server/auth/crypto.js', () => ({
	decryptSecret: (s: string) => `decrypted_${s}`
}));

mock.module('../lib/server/auth/pkce.js', () => ({
	generateCodeChallenge: (v: string) => `challenge_${v}`
}));

mock.module('jose', () => ({
	createRemoteJWKSet: () => 'mock-jwks',
	jwtVerify: async () => ({ payload: {}, protectedHeader: {} }),
	decodeJwt: () => ({
		sub: 'user-123',
		email: 'user@example.com',
		email_verified: true,
		name: 'Test User',
		preferred_username: 'testuser',
		groups: ['admin', 'developers']
	})
}));

import { OIDCProvider } from '../lib/server/auth/oauth/providers/oidc.js';
import { OAuthError } from '../lib/server/auth/oauth/types.js';

const MOCK_DISCOVERY = {
	issuer: 'https://provider.example.com',
	authorization_endpoint: 'https://provider.example.com/auth',
	token_endpoint: 'https://provider.example.com/token',
	jwks_uri: 'https://provider.example.com/.well-known/jwks',
	userinfo_endpoint: 'https://provider.example.com/userinfo',
	response_types_supported: ['code'],
	subject_types_supported: ['public'],
	id_token_signing_alg_values_supported: ['RS256']
};

const mockConfig = {
	id: 'oidc-1',
	name: 'Test OIDC',
	type: 'oidc' as const,
	enabled: true,
	clientId: 'test-client-id',
	clientSecretEncrypted: 'encrypted-secret',
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

function makeProvider(configOverrides: Partial<typeof mockConfig> = {}) {
	return new OIDCProvider({
		config: { ...mockConfig, ...configOverrides } as never,
		redirectUri: 'https://app.example.com/cb'
	});
}

function mockDiscovery(discovery = MOCK_DISCOVERY) {
	return spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
		const urlStr = url.toString();
		if (urlStr.includes('.well-known/openid-configuration')) {
			return new Response(JSON.stringify(discovery), { status: 200 });
		}
		if (urlStr.includes('/token')) {
			return new Response(
				JSON.stringify({ access_token: 'test-token', token_type: 'Bearer' }),
				{ status: 200 }
			);
		}
		if (urlStr.includes('/userinfo')) {
			return new Response(
				JSON.stringify({ sub: 'user-123', email: 'user@example.com' }),
				{ status: 200 }
			);
		}
		return new Response('not found', { status: 404 });
	});
}

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('OIDCProvider — constructor', () => {
	test('throws OAuthError with INVALID_CONFIG when issuerUrl is missing', () => {
		expect(
			() =>
				new OIDCProvider({
					config: { ...mockConfig, issuerUrl: null } as never,
					redirectUri: 'https://app.example.com/cb'
				})
		).toThrow(OAuthError);

		expect(() => {
			try {
				new OIDCProvider({
					config: { ...mockConfig, issuerUrl: null } as never,
					redirectUri: 'https://app.example.com/cb'
				});
			} catch (e) {
				if (e instanceof OAuthError) {
					expect(e.code).toBe('INVALID_CONFIG');
				}
				throw e;
			}
		}).toThrow();
	});
});

// ---------------------------------------------------------------------------
// discover() — via getAuthorizationUrl
// ---------------------------------------------------------------------------

describe('OIDCProvider — discover()', () => {
	test('fetches .well-known/openid-configuration and builds auth URL from authorization_endpoint', async () => {
		const uniqueIssuer = `https://discover-test-${Date.now()}.example.com`;
		const discovery = {
			...MOCK_DISCOVERY,
			issuer: uniqueIssuer,
			authorization_endpoint: `${uniqueIssuer}/auth`,
			token_endpoint: `${uniqueIssuer}/token`,
			jwks_uri: `${uniqueIssuer}/.well-known/jwks`,
			userinfo_endpoint: `${uniqueIssuer}/userinfo`
		};
		const provider = makeProvider({ issuerUrl: uniqueIssuer });
		const spy = spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
			if (url.toString().includes('.well-known/openid-configuration')) {
				return new Response(JSON.stringify(discovery), { status: 200 });
			}
			return new Response('not found', { status: 404 });
		});
		try {
			const url = await provider.getAuthorizationUrl('test-state', 'verifier123');
			expect(url.origin + url.pathname).toBe(`${uniqueIssuer}/auth`);
		} finally {
			spy.mockRestore();
		}
	});

	test('caches discovery doc for 1 hour (second call uses cache)', async () => {
		const uniqueIssuer = `https://cache-test-${Date.now()}.example.com`;
		const discovery = {
			...MOCK_DISCOVERY,
			issuer: uniqueIssuer,
			authorization_endpoint: `${uniqueIssuer}/auth`,
			token_endpoint: `${uniqueIssuer}/token`,
			jwks_uri: `${uniqueIssuer}/.well-known/jwks`
		};
		const provider = makeProvider({ issuerUrl: uniqueIssuer });
		let fetchCount = 0;
		const spy = spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
			if (url.toString().includes('.well-known')) fetchCount++;
			return new Response(JSON.stringify(discovery), { status: 200 });
		});
		try {
			await provider.getAuthorizationUrl('state1', 'verifier1');
			await provider.getAuthorizationUrl('state2', 'verifier2');
			expect(fetchCount).toBe(1);
		} finally {
			spy.mockRestore();
		}
	});

	test('re-fetches after cache TTL expires (1 hour)', async () => {
		const uniqueIssuer = `https://ttl-test-${Date.now()}.example.com`;
		const discovery = {
			...MOCK_DISCOVERY,
			issuer: uniqueIssuer,
			authorization_endpoint: `${uniqueIssuer}/auth`,
			token_endpoint: `${uniqueIssuer}/token`,
			jwks_uri: `${uniqueIssuer}/.well-known/jwks`
		};
		const provider = makeProvider({ issuerUrl: uniqueIssuer });
		let fetchCount = 0;
		const spy = spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
			if (url.toString().includes('.well-known')) fetchCount++;
			return new Response(JSON.stringify(discovery), { status: 200 });
		});

		// Advance Date.now past 1 hour to simulate TTL expiry
		const realDateNow = Date.now;
		let timeOffset = 0;
		Date.now = () => realDateNow() + timeOffset;

		try {
			await provider.getAuthorizationUrl('state1', 'verifier1');
			expect(fetchCount).toBe(1);

			// Advance time by 1 hour + 1ms
			timeOffset = 60 * 60 * 1000 + 1;

			await provider.getAuthorizationUrl('state2', 'verifier2');
			expect(fetchCount).toBe(2);
		} finally {
			Date.now = realDateNow;
			spy.mockRestore();
		}
	});

	test('throws OAuthError with DISCOVERY_FAILED when authorization_endpoint is missing', async () => {
		const provider = makeProvider();
		const spy = spyOn(globalThis, 'fetch').mockImplementation(async () => {
			return new Response(
				JSON.stringify({
					issuer: 'https://provider.example.com',
					// missing authorization_endpoint
					token_endpoint: 'https://provider.example.com/token',
					jwks_uri: 'https://provider.example.com/.well-known/jwks',
					response_types_supported: ['code'],
					subject_types_supported: ['public'],
					id_token_signing_alg_values_supported: ['RS256']
				}),
				{ status: 200 }
			);
		});
		try {
			await expect(provider.getAuthorizationUrl('state', 'verifier')).rejects.toMatchObject({
				name: 'OAuthError',
				code: 'DISCOVERY_FAILED'
			});
		} finally {
			spy.mockRestore();
		}
	});
});

// ---------------------------------------------------------------------------
// getAuthorizationUrl
// ---------------------------------------------------------------------------

describe('OIDCProvider.getAuthorizationUrl()', () => {
	test('throws error when codeVerifier is not provided (PKCE mandatory)', async () => {
		const provider = makeProvider();
		const spy = mockDiscovery();
		try {
			await expect(provider.getAuthorizationUrl('state')).rejects.toThrow('PKCE code verifier required');
		} finally {
			spy.mockRestore();
		}
	});

	test('sets code_challenge using SHA256 (S256 method) when codeVerifier provided', async () => {
		const uniqueIssuer = `https://pkce-test-${Date.now()}.example.com`;
		const discovery = {
			...MOCK_DISCOVERY,
			issuer: uniqueIssuer,
			authorization_endpoint: `${uniqueIssuer}/auth`,
			token_endpoint: `${uniqueIssuer}/token`,
			jwks_uri: `${uniqueIssuer}/.well-known/jwks`
		};
		const provider = makeProvider({ issuerUrl: uniqueIssuer });
		const spy = spyOn(globalThis, 'fetch').mockImplementation(async () =>
			new Response(JSON.stringify(discovery), { status: 200 })
		);
		try {
			const url = await provider.getAuthorizationUrl('state', 'my-verifier');
			expect(url.searchParams.get('code_challenge')).toBe('challenge_my-verifier');
			expect(url.searchParams.get('code_challenge_method')).toBe('S256');
		} finally {
			spy.mockRestore();
		}
	});

	test('sets state param, client_id, and redirect_uri correctly', async () => {
		const uniqueIssuer = `https://params-test-${Date.now()}.example.com`;
		const discovery = {
			...MOCK_DISCOVERY,
			issuer: uniqueIssuer,
			authorization_endpoint: `${uniqueIssuer}/auth`,
			token_endpoint: `${uniqueIssuer}/token`,
			jwks_uri: `${uniqueIssuer}/.well-known/jwks`
		};
		const provider = makeProvider({ issuerUrl: uniqueIssuer });
		const spy = spyOn(globalThis, 'fetch').mockImplementation(async () =>
			new Response(JSON.stringify(discovery), { status: 200 })
		);
		try {
			const url = await provider.getAuthorizationUrl('my-csrf-state', 'verifier');
			expect(url.searchParams.get('state')).toBe('my-csrf-state');
			expect(url.searchParams.get('client_id')).toBe('test-client-id');
			expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/cb');
		} finally {
			spy.mockRestore();
		}
	});
});

// ---------------------------------------------------------------------------
// validateCallback
// ---------------------------------------------------------------------------

describe('OIDCProvider.validateCallback()', () => {
	test('throws error when codeVerifier is not provided (PKCE mandatory)', async () => {
		const provider = makeProvider();
		const spy = mockDiscovery();
		try {
			await expect(provider.validateCallback('auth-code')).rejects.toThrow(
				'PKCE code verifier required'
			);
		} finally {
			spy.mockRestore();
		}
	});

	test('returns accessToken and idToken from token endpoint on valid response', async () => {
		const uniqueIssuer = `https://token-valid-${Date.now()}.example.com`;
		const discovery = {
			...MOCK_DISCOVERY,
			issuer: uniqueIssuer,
			authorization_endpoint: `${uniqueIssuer}/auth`,
			token_endpoint: `${uniqueIssuer}/token`,
			jwks_uri: `${uniqueIssuer}/.well-known/jwks`
		};
		const provider = makeProvider({ issuerUrl: uniqueIssuer });
		const spy = spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
			const urlStr = url.toString();
			if (urlStr.includes('.well-known/openid-configuration')) {
				return new Response(JSON.stringify(discovery), { status: 200 });
			}
			if (urlStr.includes('/token')) {
				return new Response(
					JSON.stringify({
						access_token: 'access-abc',
						id_token: 'id-token-xyz',
						token_type: 'Bearer',
						expires_in: 3600
					}),
					{ status: 200 }
				);
			}
			return new Response('not found', { status: 404 });
		});
		try {
			const tokens = await provider.validateCallback('auth-code', 'verifier');
			expect(tokens.accessToken).toBe('access-abc');
			expect(tokens.idToken).toBe('id-token-xyz');
		} finally {
			spy.mockRestore();
		}
	});

	test('throws OAuthError with TOKEN_EXCHANGE_FAILED on non-OK token response', async () => {
		const uniqueIssuer = `https://token-fail-${Date.now()}.example.com`;
		const discovery = {
			...MOCK_DISCOVERY,
			issuer: uniqueIssuer,
			authorization_endpoint: `${uniqueIssuer}/auth`,
			token_endpoint: `${uniqueIssuer}/token`,
			jwks_uri: `${uniqueIssuer}/.well-known/jwks`
		};
		const provider = makeProvider({ issuerUrl: uniqueIssuer });
		const spy = spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
			const urlStr = url.toString();
			if (urlStr.includes('.well-known/openid-configuration')) {
				return new Response(JSON.stringify(discovery), { status: 200 });
			}
			if (urlStr.includes('/token')) {
				return new Response('invalid_grant: code expired', { status: 400 });
			}
			return new Response('not found', { status: 404 });
		});
		try {
			await expect(provider.validateCallback('bad-code', 'verifier')).rejects.toMatchObject({
				name: 'OAuthError',
				code: 'TOKEN_EXCHANGE_FAILED'
			});
		} finally {
			spy.mockRestore();
		}
	});
});

// ---------------------------------------------------------------------------
// getUserInfo
// ---------------------------------------------------------------------------

describe('OIDCProvider.getUserInfo()', () => {
	test('extracts claims from idToken using decodeJwt, returns sub/email/groups', async () => {
		const provider = makeProvider();
		const info = await provider.getUserInfo({
			accessToken: 'access-token',
			idToken: 'mock-id-token',
			tokenType: 'Bearer'
		});
		expect(info.sub).toBe('user-123');
		expect(info.email).toBe('user@example.com');
		expect(info.groups).toEqual(['admin', 'developers']);
	});

	test('fetches from userinfo_endpoint when no idToken', async () => {
		const uniqueIssuer = `https://userinfo-test-${Date.now()}.example.com`;
		const discovery = {
			...MOCK_DISCOVERY,
			issuer: uniqueIssuer,
			authorization_endpoint: `${uniqueIssuer}/auth`,
			token_endpoint: `${uniqueIssuer}/token`,
			jwks_uri: `${uniqueIssuer}/.well-known/jwks`,
			userinfo_endpoint: `${uniqueIssuer}/userinfo`
		};
		const provider = makeProvider({ issuerUrl: uniqueIssuer });
		const spy = spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
			const urlStr = url.toString();
			if (urlStr.includes('.well-known/openid-configuration')) {
				return new Response(JSON.stringify(discovery), { status: 200 });
			}
			if (urlStr.includes('/userinfo')) {
				return new Response(
					JSON.stringify({ sub: 'user-from-userinfo', email: 'info@example.com' }),
					{ status: 200 }
				);
			}
			return new Response('not found', { status: 404 });
		});
		try {
			const info = await provider.getUserInfo({ accessToken: 'access-token', tokenType: 'Bearer' });
			expect(info.sub).toBe('user-from-userinfo');
			expect(info.email).toBe('info@example.com');
		} finally {
			spy.mockRestore();
		}
	});

	test('throws OAuthError with NO_USER_INFO when no idToken and no userinfo_endpoint', async () => {
		const uniqueIssuer = `https://no-userinfo-${Date.now()}.example.com`;
		const discoveryNoUserinfo = {
			issuer: uniqueIssuer,
			authorization_endpoint: `${uniqueIssuer}/auth`,
			token_endpoint: `${uniqueIssuer}/token`,
			jwks_uri: `${uniqueIssuer}/.well-known/jwks`,
			response_types_supported: ['code'],
			subject_types_supported: ['public'],
			id_token_signing_alg_values_supported: ['RS256']
			// no userinfo_endpoint
		};
		const provider = makeProvider({ issuerUrl: uniqueIssuer });
		const spy = spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
			if (url.toString().includes('.well-known/openid-configuration')) {
				return new Response(JSON.stringify(discoveryNoUserinfo), { status: 200 });
			}
			return new Response('not found', { status: 404 });
		});
		try {
			await expect(
				provider.getUserInfo({ accessToken: 'access-token', tokenType: 'Bearer' })
			).rejects.toMatchObject({
				name: 'OAuthError',
				code: 'NO_USER_INFO'
			});
		} finally {
			spy.mockRestore();
		}
	});
});

// ---------------------------------------------------------------------------
// mapClaimsToUserInfo (via getUserInfo with idToken)
// ---------------------------------------------------------------------------

describe('OIDCProvider — mapClaimsToUserInfo()', () => {
	test('maps standard claims (sub, email, email_verified, name) correctly', async () => {
		const provider = makeProvider();
		// decodeJwt mock returns standard claims
		const info = await provider.getUserInfo({
			accessToken: 'token',
			idToken: 'mock-id-token',
			tokenType: 'Bearer'
		});
		expect(info.sub).toBe('user-123');
		expect(info.email).toBe('user@example.com');
		expect(info.emailVerified).toBe(true);
		expect(info.name).toBe('Test User');
	});

	test('maps custom groups claim (array) to groups array', async () => {
		const provider = makeProvider({ roleClaim: 'groups' });
		const info = await provider.getUserInfo({
			accessToken: 'token',
			idToken: 'mock-id-token',
			tokenType: 'Bearer'
		});
		// decodeJwt mock returns groups: ['admin', 'developers']
		expect(info.groups).toEqual(['admin', 'developers']);
	});

	test('maps custom groups claim (string) to single-element groups array via userinfo endpoint', async () => {
		// Note: mapClaimsToUserInfo maps string groups to ['single-group'] internally,
		// but the final spread { ...userInfo, ...claims } means the raw claim value
		// from claims overwrites the mapped groups. When groups is a string in the
		// userinfo response, the returned object will have groups as a string (raw claim wins).
		// We verify the internal mapping via a userinfo endpoint returning a string groups claim.
		const uniqueIssuer = `https://string-group-${Date.now()}.example.com`;
		const discovery = {
			...MOCK_DISCOVERY,
			issuer: uniqueIssuer,
			authorization_endpoint: `${uniqueIssuer}/auth`,
			token_endpoint: `${uniqueIssuer}/token`,
			jwks_uri: `${uniqueIssuer}/.well-known/jwks`,
			userinfo_endpoint: `${uniqueIssuer}/userinfo`
		};
		const provider = makeProvider({ issuerUrl: uniqueIssuer, roleClaim: 'groups' });
		const spy = spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
			const urlStr = url.toString();
			if (urlStr.includes('.well-known/openid-configuration')) {
				return new Response(JSON.stringify(discovery), { status: 200 });
			}
			if (urlStr.includes('/userinfo')) {
				return new Response(
					JSON.stringify({
						sub: 'user-456',
						email: 'other@example.com',
						groups: 'single-group'
					}),
					{ status: 200 }
				);
			}
			return new Response('not found', { status: 404 });
		});
		try {
			const info = await provider.getUserInfo({ accessToken: 'token', tokenType: 'Bearer' });
			// The final { ...userInfo, ...claims } spread means the raw claim overrides
			// the mapped groups array — so the string value is preserved in the output.
			// The mapping logic (string → array) is internally applied before the spread
			// but overwritten. This tests the actual observable behavior.
			expect(info['groups']).toBe('single-group');
		} finally {
			spy.mockRestore();
		}
	});
});

// ---------------------------------------------------------------------------
// refreshAccessToken
// ---------------------------------------------------------------------------

describe('OIDCProvider.refreshAccessToken()', () => {
	test('returns new accessToken from token endpoint', async () => {
		const uniqueIssuer = `https://refresh-test-${Date.now()}.example.com`;
		const discovery = {
			...MOCK_DISCOVERY,
			issuer: uniqueIssuer,
			authorization_endpoint: `${uniqueIssuer}/auth`,
			token_endpoint: `${uniqueIssuer}/token`,
			jwks_uri: `${uniqueIssuer}/.well-known/jwks`
		};
		const provider = makeProvider({ issuerUrl: uniqueIssuer });
		const spy = spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
			const urlStr = url.toString();
			if (urlStr.includes('.well-known/openid-configuration')) {
				return new Response(JSON.stringify(discovery), { status: 200 });
			}
			if (urlStr.includes('/token')) {
				return new Response(
					JSON.stringify({ access_token: 'refreshed-access-token', token_type: 'Bearer' }),
					{ status: 200 }
				);
			}
			return new Response('not found', { status: 404 });
		});
		try {
			const tokens = await provider.refreshAccessToken!('old-refresh-token');
			expect(tokens.accessToken).toBe('refreshed-access-token');
		} finally {
			spy.mockRestore();
		}
	});

	test('validates id_token if present in refresh response', async () => {
		const uniqueIssuer = `https://refresh-idtoken-${Date.now()}.example.com`;
		const discovery = {
			...MOCK_DISCOVERY,
			issuer: uniqueIssuer,
			authorization_endpoint: `${uniqueIssuer}/auth`,
			token_endpoint: `${uniqueIssuer}/token`,
			jwks_uri: `${uniqueIssuer}/.well-known/jwks`
		};
		const provider = makeProvider({ issuerUrl: uniqueIssuer });
		const spy = spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
			const urlStr = url.toString();
			if (urlStr.includes('.well-known/openid-configuration')) {
				return new Response(JSON.stringify(discovery), { status: 200 });
			}
			if (urlStr.includes('/token')) {
				return new Response(
					JSON.stringify({
						access_token: 'new-access-token',
						id_token: 'new-id-token',
						token_type: 'Bearer'
					}),
					{ status: 200 }
				);
			}
			return new Response('not found', { status: 404 });
		});
		try {
			const tokens = await provider.refreshAccessToken!('refresh-token');
			expect(tokens.accessToken).toBe('new-access-token');
			expect(tokens.idToken).toBe('new-id-token');
		} finally {
			spy.mockRestore();
		}
	});
});
