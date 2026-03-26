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
	roleMapping: null as string | null,
	roleClaim: 'groups',
	usernameClaim: 'preferred_username',
	emailClaim: 'email',
	usePkce: true,
	scopes: 'read:user user:email',
	createdAt: new Date(),
	updatedAt: new Date()
};

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
	test('sends code_verifier in request body', async () => {
		let capturedBody: string | null = null;
		const spy = spyOn(globalThis, 'fetch').mockImplementation(
			async (_url: string | URL | Request, init?: RequestInit) => {
				capturedBody = init?.body?.toString() ?? null;
				return new Response(
					JSON.stringify({ access_token: 'pkce-access-token', token_type: 'bearer' }),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				);
			}
		);
		try {
			const provider = makeProvider();
			await provider.validateCallback('auth-code', 'my-code-verifier');
			expect(capturedBody).toContain('code_verifier=my-code-verifier');
			expect(capturedBody).toContain('code=auth-code');
		} finally {
			spy.mockRestore();
		}
	});

	test('returns accessToken extracted from token response', async () => {
		const spy = spyOn(globalThis, 'fetch').mockImplementation(async () => {
			return new Response(
				JSON.stringify({ access_token: 'pkce-access-token', token_type: 'bearer' }),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			);
		});
		try {
			const provider = makeProvider();
			const tokens = await provider.validateCallback('auth-code', 'my-code-verifier');
			expect(tokens.accessToken).toBe('pkce-access-token');
		} finally {
			spy.mockRestore();
		}
	});

	test('throws OAuthError when request times out', async () => {
		const spy = spyOn(globalThis, 'fetch').mockImplementation(async () => {
			const err = new DOMException('The operation was aborted', 'AbortError');
			throw err;
		});
		try {
			const provider = makeProvider();
			await expect(provider.validateCallback('code', 'verifier')).rejects.toMatchObject({
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
							login: 'octocat',
							email: 'user@github.com',
							name: 'The Octocat',
							avatar_url: 'https://example.com/avatar.png',
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

	test('returns user info with email, sub, username, and empty groups', async () => {
		const provider = makeProvider();
		const info = await provider.getUserInfo({ accessToken: 'token', tokenType: 'Bearer' });
		expect(info.email).toBe('user@github.com');
		expect(info.sub).toBe('42');
		expect(info.username).toBe('octocat');
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
		const provider = makeProvider({ roleMapping: '{}' as unknown as string });
		const info = await provider.getUserInfo({ accessToken: 'tok', tokenType: 'Bearer' });
		expect(info.groups).toContain('my-org');
		expect(info.groups).toContain('another-org');
	});

	test('includes org/team-slug format for each team', async () => {
		const provider = makeProvider({ roleMapping: '{}' as unknown as string });
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
});
