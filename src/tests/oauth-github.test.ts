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

mock.module('arctic', () => ({
	GitHub: class MockGitHub {
		createAuthorizationURL(state: string, scopes: string[]) {
			return new URL(
				`https://github.com/login/oauth/authorize?state=${state}&scope=${scopes.join(',')}`
			);
		}
		async validateAuthorizationCode(_code: string) {
			return {
				accessToken: () => 'arctic-access-token',
				hasScopes: () => true,
				scopes: () => ['read:user', 'user:email'],
				accessTokenExpiresAt: () => null
			};
		}
	}
}));

import { GitHubProvider } from '../lib/server/auth/oauth/providers/github.js';
import { OAuthError } from '../lib/server/auth/oauth/types.js';

const mockConfig = {
	id: 'github-1',
	name: 'GitHub',
	type: 'oauth2-github',
	enabled: true,
	clientId: 'test-client-id',
	clientSecretEncrypted: 'encrypted-secret',
	issuerUrl: null,
	authorizationUrl: null,
	tokenUrl: null,
	userInfoUrl: null,
	jwksUrl: null,
	autoProvision: true,
	defaultRole: 'viewer',
	roleMapping: null,
	roleClaim: 'groups',
	usernameClaim: 'preferred_username',
	emailClaim: 'email',
	usePkce: true,
	scopes: 'read:user user:email',
	createdAt: new Date(),
	updatedAt: new Date()
} as const;

// Helpers
function makeProvider(configOverrides: Partial<typeof mockConfig> = {}) {
	return new GitHubProvider({
		config: { ...mockConfig, ...configOverrides } as never,
		redirectUri: 'https://example.com/callback'
	});
}

// ---------------------------------------------------------------------------
// getAuthorizationUrl
// ---------------------------------------------------------------------------

describe('GitHubProvider.getAuthorizationUrl()', () => {
	test('includes state param in returned URL', async () => {
		const provider = makeProvider();
		const url = await provider.getAuthorizationUrl('test-state-123');
		expect(url.searchParams.get('state')).toBe('test-state-123');
	});

	test('includes read:user and user:email scopes', async () => {
		const provider = makeProvider({ scopes: 'read:user' });
		const url = await provider.getAuthorizationUrl('s');
		const scope = url.searchParams.get('scope') ?? '';
		expect(scope).toContain('read:user');
		expect(scope).toContain('user:email');
	});

	test('filters out OIDC-specific scopes (openid, profile)', async () => {
		const provider = makeProvider({ scopes: 'read:user openid profile user:email' });
		const url = await provider.getAuthorizationUrl('s');
		const scope = url.searchParams.get('scope') ?? '';
		expect(scope).not.toContain('openid');
		expect(scope).not.toContain('profile');
	});

	test('appends code_challenge when codeVerifier is provided (PKCE)', async () => {
		const provider = makeProvider();
		const url = await provider.getAuthorizationUrl('s', 'my-verifier');
		expect(url.searchParams.get('code_challenge')).toBe('challenge_my-verifier');
		expect(url.searchParams.get('code_challenge_method')).toBe('S256');
	});

	test('does not append code_challenge without codeVerifier', async () => {
		const provider = makeProvider();
		const url = await provider.getAuthorizationUrl('s');
		expect(url.searchParams.has('code_challenge')).toBe(false);
		expect(url.searchParams.has('code_challenge_method')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// validateCallback — PKCE path
// ---------------------------------------------------------------------------

describe('GitHubProvider.validateCallback() — PKCE path', () => {
	let fetchSpy: ReturnType<typeof spyOn>;
	let capturedBody: string | null = null;

	beforeEach(() => {
		capturedBody = null;
		fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
			async (input: string | URL | Request) => {
				const urlStr = input.toString();
				if (urlStr.includes('access_token')) {
					// Capture the request body for later assertions via a side channel
					// (fetch mock receives Request object when body is set)
					if (input instanceof Request) {
						capturedBody = await input.text();
					}
					return new Response(
						JSON.stringify({
							access_token: 'pkce-access-token',
							token_type: 'bearer',
							scope: 'read:user user:email'
						}),
						{ status: 200, headers: { 'Content-Type': 'application/json' } }
					);
				}
				return new Response('not found', { status: 404 });
			}
		);
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	test('calls GitHub token endpoint with code_verifier in body', async () => {
		const provider = makeProvider();
		// We capture what was sent; since fetch mock receives string body, we need
		// to intercept differently — check fetch was called with the right URL
		const fetchMock = spyOn(globalThis, 'fetch').mockImplementation(
			async (input: string | URL | Request, init?: RequestInit) => {
				const urlStr = input.toString();
				if (urlStr.includes('access_token')) {
					const body = init?.body?.toString() ?? '';
					capturedBody = body;
					return new Response(
						JSON.stringify({ access_token: 'pkce-access-token', token_type: 'bearer' }),
						{ status: 200, headers: { 'Content-Type': 'application/json' } }
					);
				}
				return new Response('not found', { status: 404 });
			}
		);

		await provider.validateCallback('auth-code', 'my-code-verifier');

		expect(capturedBody).toContain('code_verifier=my-code-verifier');
		expect(capturedBody).toContain('code=auth-code');
		fetchMock.mockRestore();
	});

	test('returns accessToken extracted from token response', async () => {
		// Use a fresh spy that captures init
		fetchSpy.mockRestore();
		const fetchMock2 = spyOn(globalThis, 'fetch').mockImplementation(
			async (_input: string | URL | Request, _init?: RequestInit) => {
				return new Response(
					JSON.stringify({ access_token: 'pkce-access-token', token_type: 'bearer' }),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				);
			}
		);

		const provider = makeProvider();
		const tokens = await provider.validateCallback('auth-code', 'my-code-verifier');

		expect(tokens.accessToken).toBe('pkce-access-token');
		fetchMock2.mockRestore();
	});
});

// ---------------------------------------------------------------------------
// validateCallback — non-PKCE path (Arctic)
// ---------------------------------------------------------------------------

describe('GitHubProvider.validateCallback() — non-PKCE path', () => {
	test('returns token from Arctic client when no codeVerifier provided', async () => {
		const provider = makeProvider();
		const tokens = await provider.validateCallback('auth-code');
		expect(tokens.accessToken).toBe('arctic-access-token');
	});
});

// ---------------------------------------------------------------------------
// validateCallback — error handling
// ---------------------------------------------------------------------------

describe('GitHubProvider.validateCallback() — error handling', () => {
	let fetchSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
			async (_input: string | URL | Request, _init?: RequestInit) => {
				return new Response('Bad credentials', { status: 401 });
			}
		);
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	test('throws OAuthError with TOKEN_EXCHANGE_FAILED when token endpoint returns non-OK', async () => {
		const provider = makeProvider();
		await expect(provider.validateCallback('bad-code', 'verifier')).rejects.toMatchObject({
			name: 'OAuthError',
			code: 'TOKEN_EXCHANGE_FAILED'
		});
	});

	test('thrown error is an instance of OAuthError', async () => {
		const provider = makeProvider();
		let caughtError: unknown;
		try {
			await provider.validateCallback('bad-code', 'verifier');
		} catch (e) {
			caughtError = e;
		}
		expect(caughtError).toBeInstanceOf(OAuthError);
	});
});

// ---------------------------------------------------------------------------
// getUserInfo — user has email in profile
// ---------------------------------------------------------------------------

describe('GitHubProvider.getUserInfo() — email in profile', () => {
	let fetchSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
			async (input: string | URL | Request) => {
				const urlStr = input.toString();
				if (urlStr === 'https://api.github.com/user') {
					return new Response(
						JSON.stringify({
							id: 42,
							login: 'testuser',
							name: 'Test User',
							email: 'test@example.com',
							avatar_url: 'https://github.com/avatars/42',
							type: 'User'
						}),
						{ status: 200, headers: { 'Content-Type': 'application/json' } }
					);
				}
				return new Response('not found', { status: 404 });
			}
		);
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	test('uses email from profile directly when present', async () => {
		const provider = makeProvider();
		const info = await provider.getUserInfo({ accessToken: 'tok', tokenType: 'Bearer' });
		expect(info.email).toBe('test@example.com');
	});

	test('sets sub to user id string', async () => {
		const provider = makeProvider();
		const info = await provider.getUserInfo({ accessToken: 'tok', tokenType: 'Bearer' });
		expect(info.sub).toBe('42');
	});

	test('sets username to login', async () => {
		const provider = makeProvider();
		const info = await provider.getUserInfo({ accessToken: 'tok', tokenType: 'Bearer' });
		expect(info.username).toBe('testuser');
	});

	test('groups is empty when no roleMapping configured', async () => {
		const provider = makeProvider({ roleMapping: null });
		const info = await provider.getUserInfo({ accessToken: 'tok', tokenType: 'Bearer' });
		expect(info.groups).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// getUserInfo — user has no email in profile, falls back to /user/emails
// ---------------------------------------------------------------------------

describe('GitHubProvider.getUserInfo() — no email in profile', () => {
	let fetchSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
			async (input: string | URL | Request) => {
				const urlStr = input.toString();
				if (urlStr === 'https://api.github.com/user') {
					return new Response(
						JSON.stringify({
							id: 99,
							login: 'noemail',
							name: 'No Email',
							email: null,
							avatar_url: null,
							type: 'User'
						}),
						{ status: 200, headers: { 'Content-Type': 'application/json' } }
					);
				}
				if (urlStr === 'https://api.github.com/user/emails') {
					return new Response(
						JSON.stringify([
							{ email: 'secondary@example.com', primary: false, verified: true, visibility: null },
							{ email: 'primary@example.com', primary: true, verified: true, visibility: 'public' }
						]),
						{ status: 200, headers: { 'Content-Type': 'application/json' } }
					);
				}
				return new Response('not found', { status: 404 });
			}
		);
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	test('falls back to /user/emails and uses primary verified email', async () => {
		const provider = makeProvider();
		const info = await provider.getUserInfo({ accessToken: 'tok', tokenType: 'Bearer' });
		expect(info.email).toBe('primary@example.com');
	});
});

// ---------------------------------------------------------------------------
// fetchGroups (via getUserInfo with roleMapping)
// ---------------------------------------------------------------------------

describe('GitHubProvider.getUserInfo() — fetchGroups with roleMapping', () => {
	let fetchSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
			async (input: string | URL | Request) => {
				const urlStr = input.toString();
				if (urlStr === 'https://api.github.com/user') {
					return new Response(
						JSON.stringify({
							id: 7,
							login: 'orgmember',
							name: 'Org Member',
							email: 'member@example.com',
							avatar_url: null,
							type: 'User'
						}),
						{ status: 200, headers: { 'Content-Type': 'application/json' } }
					);
				}
				if (urlStr === 'https://api.github.com/user/orgs') {
					return new Response(
						JSON.stringify([
							{ login: 'my-org', id: 1, description: '' },
							{ login: 'another-org', id: 2, description: '' }
						]),
						{ status: 200, headers: { 'Content-Type': 'application/json' } }
					);
				}
				if (urlStr === 'https://api.github.com/user/teams') {
					return new Response(
						JSON.stringify([
							{ name: 'Backend Team', slug: 'backend-team', organization: { login: 'my-org' } },
							{ name: 'All Team', slug: 'all-team', organization: { login: 'another-org' } }
						]),
						{ status: 200, headers: { 'Content-Type': 'application/json' } }
					);
				}
				return new Response('not found', { status: 404 });
			}
		);
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	test('includes org names in groups', async () => {
		const provider = makeProvider({ roleMapping: '{}' } as never);
		const info = await provider.getUserInfo({ accessToken: 'tok', tokenType: 'Bearer' });
		expect(info.groups).toContain('my-org');
		expect(info.groups).toContain('another-org');
	});

	test('includes org/team-slug format for each team', async () => {
		const provider = makeProvider({ roleMapping: '{}' } as never);
		const info = await provider.getUserInfo({ accessToken: 'tok', tokenType: 'Bearer' });
		expect(info.groups).toContain('my-org/backend-team');
		expect(info.groups).toContain('another-org/all-team');
	});
});

// ---------------------------------------------------------------------------
// getUserInfo — GitHub API failure
// ---------------------------------------------------------------------------

describe('GitHubProvider.getUserInfo() — API failure', () => {
	let fetchSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
			async (_input: string | URL | Request) => {
				return new Response('Internal Server Error', { status: 500 });
			}
		);
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	test('throws OAuthError with USERINFO_FAILED code on GitHub API failure', async () => {
		const provider = makeProvider();
		await expect(
			provider.getUserInfo({ accessToken: 'bad-token', tokenType: 'Bearer' })
		).rejects.toMatchObject({
			name: 'OAuthError',
			code: 'USERINFO_FAILED'
		});
	});

	test('thrown error is an instance of OAuthError', async () => {
		const provider = makeProvider();
		let caughtError: unknown;
		try {
			await provider.getUserInfo({ accessToken: 'bad-token', tokenType: 'Bearer' });
		} catch (e) {
			caughtError = e;
		}
		expect(caughtError).toBeInstanceOf(OAuthError);
	});
});
