import { describe, test, expect, afterAll, mock, spyOn } from 'bun:test';

const consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
const consoleWarnSpy = spyOn(console, 'warn').mockImplementation(() => {});

afterAll(() => {
	consoleLogSpy.mockRestore();
	consoleErrorSpy.mockRestore();
	consoleWarnSpy.mockRestore();
});

mock.module('../lib/server/auth/crypto.js', () => ({
	decryptSecret: (s: string) => `decrypted_${s}`
}));

mock.module('../lib/server/auth/pkce.js', () => ({
	generateCodeChallenge: (v: string) => `challenge_${v}`
}));

// Mock arctic GitLab class — createAuthorizationURL is async
mock.module('arctic', () => ({
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
		async validateAuthorizationCode(_code: string) {
			return {
				accessToken: () => 'arctic-access-token',
				hasRefreshToken: () => false,
				refreshToken: () => undefined,
				accessTokenExpiresAt: () => null
			};
		}
	}
}));

mock.module('../lib/server/logger.js', () => ({
	logger: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} }
}));

import { GitLabProvider } from '../lib/server/auth/oauth/providers/gitlab.js';

const mockConfig = {
	id: 'gitlab-1',
	name: 'GitLab',
	type: 'oauth2-gitlab' as const,
	enabled: true,
	clientId: 'test-client-id',
	clientSecretEncrypted: 'encrypted-secret',
	issuerUrl: 'https://gitlab.com',
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
	scopes: 'read_user openid profile email',
	createdAt: new Date(),
	updatedAt: new Date()
};

function makeProvider(overrides: Record<string, unknown> = {}) {
	return GitLabProvider({
		config: { ...mockConfig, ...overrides } as typeof mockConfig,
		redirectUri: 'https://app.example.com/callback'
	});
}

// ---------------------------------------------------------------------------
// Issuer URL normalization
// ---------------------------------------------------------------------------

describe('GitLabProvider — issuerUrl normalization', () => {
	test('strips trailing slash from issuerUrl when making API calls', async () => {
		let capturedUrl: string | null = null;
		const spy = spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
			capturedUrl = url.toString();
			return new Response(
				JSON.stringify({
					id: 1,
					username: 'user',
					email: 'user@example.com',
					name: 'Test User',
					avatar_url: null,
					confirmed_at: '2024-01-01T00:00:00Z'
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			);
		});
		try {
			const provider = makeProvider({ issuerUrl: 'https://gitlab.com/' });
			await provider.getUserInfo({ accessToken: 'tok', tokenType: 'Bearer' });
			expect(capturedUrl).toBe('https://gitlab.com/api/v4/user');
		} finally {
			spy.mockRestore();
		}
	});
});

// ---------------------------------------------------------------------------
// getAuthorizationUrl
// ---------------------------------------------------------------------------

describe('GitLabProvider.getAuthorizationUrl()', () => {
	test('includes state param in returned URL', async () => {
		const provider = makeProvider();
		const url = await provider.getAuthorizationUrl('test-state-abc');
		expect(url.searchParams.get('state')).toBe('test-state-abc');
	});

	test('uses default scopes when config.scopes is empty string', async () => {
		const provider = makeProvider({ scopes: '' });
		const url = await provider.getAuthorizationUrl('s');
		const scope = url.searchParams.get('scope') ?? '';
		expect(scope).toContain('read_user');
		expect(scope).toContain('openid');
		expect(scope).toContain('profile');
		expect(scope).toContain('email');
	});

	test('adds read_api scope when roleMapping is set and api/read_api not already present', async () => {
		const provider = makeProvider({ roleMapping: '{}', scopes: 'read_user openid' });
		const url = await provider.getAuthorizationUrl('s');
		const scope = url.searchParams.get('scope') ?? '';
		expect(scope).toContain('read_api');
	});

	test('does not duplicate read_api when already present in scopes', async () => {
		const provider = makeProvider({ roleMapping: '{}', scopes: 'read_user read_api' });
		const url = await provider.getAuthorizationUrl('s');
		const scope = url.searchParams.get('scope') ?? '';
		const count = scope.split(',').filter((s) => s === 'read_api').length;
		expect(count).toBe(1);
	});

	test('sets code_challenge when codeVerifier is provided (PKCE)', async () => {
		const provider = makeProvider();
		const url = await provider.getAuthorizationUrl('s', 'my-verifier');
		expect(url.searchParams.get('code_challenge')).toBe('challenge_my-verifier');
		expect(url.searchParams.get('code_challenge_method')).toBe('S256');
	});

	test('does not set code_challenge without codeVerifier', async () => {
		const provider = makeProvider();
		const url = await provider.getAuthorizationUrl('s');
		expect(url.searchParams.has('code_challenge')).toBe(false);
		expect(url.searchParams.has('code_challenge_method')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// validateCallback — PKCE path
// ---------------------------------------------------------------------------

describe('GitLabProvider.validateCallback() — PKCE path', () => {
	test('POSTs to ${baseURL}/oauth/token with code_verifier in body', async () => {
		let capturedUrl: string | null = null;
		let capturedBody: string | null = null;
		const spy = spyOn(globalThis, 'fetch').mockImplementation(async (url, init?: RequestInit) => {
			capturedUrl = url.toString();
			capturedBody = init?.body?.toString() ?? null;
			return new Response(JSON.stringify({ access_token: 'pkce-token', token_type: 'bearer' }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			});
		});
		try {
			const provider = makeProvider();
			await provider.validateCallback('auth-code', 'my-verifier');
			expect(capturedUrl).toBe('https://gitlab.com/oauth/token');
			expect(capturedBody).toContain('code_verifier=my-verifier');
			expect(capturedBody).toContain('code=auth-code');
		} finally {
			spy.mockRestore();
		}
	});

	test('returns accessToken extracted from token response', async () => {
		const spy = spyOn(globalThis, 'fetch').mockImplementation(async () => {
			return new Response(
				JSON.stringify({ access_token: 'pkce-access-token', token_type: 'bearer' }),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			);
		});
		try {
			const provider = makeProvider();
			const tokens = await provider.validateCallback('auth-code', 'my-verifier');
			expect(tokens.accessToken).toBe('pkce-access-token');
		} finally {
			spy.mockRestore();
		}
	});

	test('throws OAuthError when request times out', async () => {
		const spy = spyOn(globalThis, 'fetch').mockImplementation(async () => {
			throw new DOMException('The operation was aborted', 'AbortError');
		});
		try {
			const provider = makeProvider();
			await expect(provider.validateCallback('auth-code', 'my-verifier')).rejects.toMatchObject({
				code: 'TOKEN_EXCHANGE_FAILED'
			});
		} finally {
			spy.mockRestore();
		}
	});
});

// ---------------------------------------------------------------------------
// validateCallback — non-PKCE path (Arctic)
// ---------------------------------------------------------------------------

describe('GitLabProvider.validateCallback() — non-PKCE path', () => {
	test('returns token from Arctic client when no codeVerifier provided', async () => {
		const provider = makeProvider();
		const tokens = await provider.validateCallback('auth-code');
		expect(tokens.accessToken).toBe('arctic-access-token');
	});
});

// ---------------------------------------------------------------------------
// validateCallback — error handling
// ---------------------------------------------------------------------------

describe('GitLabProvider.validateCallback() — error handling', () => {
	test('throws OAuthError with TOKEN_EXCHANGE_FAILED on non-OK response', async () => {
		const spy = spyOn(globalThis, 'fetch').mockImplementation(async () => {
			return new Response('Unauthorized', { status: 401 });
		});
		try {
			const provider = makeProvider();
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
// refreshAccessToken
// ---------------------------------------------------------------------------

describe('GitLabProvider.refreshAccessToken()', () => {
	test('POSTs grant_type=refresh_token and refresh_token to token endpoint', async () => {
		let capturedBody: string | null = null;
		const spy = spyOn(globalThis, 'fetch').mockImplementation(async (_url, init?: RequestInit) => {
			capturedBody = init?.body?.toString() ?? null;
			return new Response(
				JSON.stringify({ access_token: 'new-access-token', token_type: 'bearer' }),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			);
		});
		try {
			const provider = makeProvider();
			const tokens = await provider.refreshAccessToken!('old-refresh-token');
			expect(capturedBody).toContain('grant_type=refresh_token');
			expect(capturedBody).toContain('refresh_token=old-refresh-token');
			expect(tokens.accessToken).toBe('new-access-token');
		} finally {
			spy.mockRestore();
		}
	});

	test('throws OAuthError with TOKEN_REFRESH_FAILED on non-OK response', async () => {
		const spy = spyOn(globalThis, 'fetch').mockImplementation(async () => {
			return new Response('Bad Request', { status: 400 });
		});
		try {
			const provider = makeProvider();
			await expect(provider.refreshAccessToken!('bad-token')).rejects.toMatchObject({
				name: 'OAuthError',
				code: 'TOKEN_REFRESH_FAILED'
			});
		} finally {
			spy.mockRestore();
		}
	});
});

// ---------------------------------------------------------------------------
// getUserInfo
// ---------------------------------------------------------------------------

describe('GitLabProvider.getUserInfo()', () => {
	test('confirmed_at present → emailVerified: true', async () => {
		const spy = spyOn(globalThis, 'fetch').mockImplementation(async () => {
			return new Response(
				JSON.stringify({
					id: 10,
					username: 'gituser',
					email: 'git@example.com',
					name: 'Git User',
					avatar_url: 'https://gitlab.com/avatar.png',
					confirmed_at: '2024-06-01T00:00:00Z'
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			);
		});
		try {
			const provider = makeProvider();
			const info = await provider.getUserInfo({ accessToken: 'tok', tokenType: 'Bearer' });
			expect(info.emailVerified).toBe(true);
			expect(info.sub).toBe('10');
			expect(info.email).toBe('git@example.com');
			expect(info.username).toBe('gituser');
			expect(info.groups).toEqual([]);
		} finally {
			spy.mockRestore();
		}
	});

	test('confirmed_at absent → emailVerified: false', async () => {
		const spy = spyOn(globalThis, 'fetch').mockImplementation(async () => {
			return new Response(
				JSON.stringify({
					id: 20,
					username: 'unverified',
					email: 'unverified@example.com',
					name: 'Unverified User',
					avatar_url: null
					// confirmed_at intentionally omitted
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			);
		});
		try {
			const provider = makeProvider();
			const info = await provider.getUserInfo({ accessToken: 'tok', tokenType: 'Bearer' });
			expect(info.emailVerified).toBe(false);
		} finally {
			spy.mockRestore();
		}
	});

	test('with roleMapping: fetches groups and populates groups with full_path values', async () => {
		const spy = spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
			const urlStr = url.toString();
			if (urlStr.includes('/api/v4/user')) {
				return new Response(
					JSON.stringify({
						id: 30,
						username: 'groupmember',
						email: 'member@example.com',
						name: 'Group Member',
						avatar_url: null,
						confirmed_at: '2024-01-01T00:00:00Z'
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } }
				);
			}
			if (urlStr.includes('/api/v4/groups')) {
				return new Response(
					JSON.stringify([
						{ id: 1, name: 'My Group', path: 'my-group', full_path: 'my-org/my-group' },
						{ id: 2, name: 'Other Group', path: 'other-group', full_path: 'other-group' }
					]),
					{
						status: 200,
						headers: { 'content-type': 'application/json', 'x-next-page': '' }
					}
				);
			}
			return new Response('not found', { status: 404 });
		});
		try {
			const provider = makeProvider({ roleMapping: '{}' });
			const info = await provider.getUserInfo({ accessToken: 'tok', tokenType: 'Bearer' });
			expect(info.groups).toContain('my-org/my-group');
			expect(info.groups).toContain('other-group');
		} finally {
			spy.mockRestore();
		}
	});

	test('throws OAuthError with USERINFO_FAILED on API failure', async () => {
		const spy = spyOn(globalThis, 'fetch').mockImplementation(async () => {
			return new Response('Internal Server Error', { status: 500 });
		});
		try {
			const provider = makeProvider();
			await expect(
				provider.getUserInfo({ accessToken: 'bad-token', tokenType: 'Bearer' })
			).rejects.toMatchObject({
				name: 'OAuthError',
				code: 'USERINFO_FAILED'
			});
		} finally {
			spy.mockRestore();
		}
	});
});

// ---------------------------------------------------------------------------
// fetchGitLabGroups pagination (via getUserInfo with roleMapping)
// ---------------------------------------------------------------------------

describe('GitLabProvider — fetchGitLabGroups pagination', () => {
	test('combines groups from all pages when x-next-page header is present', async () => {
		let callCount = 0;
		const spy = spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
			const urlStr = url.toString();
			if (urlStr.includes('/api/v4/user')) {
				return new Response(
					JSON.stringify({
						id: 50,
						username: 'paginated',
						email: 'paginated@example.com',
						name: 'Paginated User',
						avatar_url: null,
						confirmed_at: '2024-01-01T00:00:00Z'
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } }
				);
			}
			// Groups endpoint — paginated
			callCount++;
			const groups =
				callCount === 1
					? [{ id: 1, name: 'Group 1', path: 'group-1', full_path: 'group-1' }]
					: [{ id: 2, name: 'Group 2', path: 'group-2', full_path: 'group-2' }];
			const nextPage = callCount === 1 ? '2' : '';
			return new Response(JSON.stringify(groups), {
				status: 200,
				headers: { 'content-type': 'application/json', 'x-next-page': nextPage }
			});
		});
		try {
			const provider = makeProvider({ roleMapping: '{}' });
			const info = await provider.getUserInfo({ accessToken: 'tok', tokenType: 'Bearer' });
			expect(info.groups).toContain('group-1');
			expect(info.groups).toContain('group-2');
			expect(callCount).toBe(2);
		} finally {
			spy.mockRestore();
		}
	});
});
