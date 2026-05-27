import { vi } from 'vitest';

type ArcticMockOptions = {
	google?: {
		shouldThrow?: () => boolean;
	};
};

type JoseMockOptions = {
	decodeJwt?: () => Record<string, unknown>;
};

export function suppressOAuthProviderConsole() {
	const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
	const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
	const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

	return {
		restore() {
			consoleLogSpy.mockRestore();
			consoleErrorSpy.mockRestore();
			consoleWarnSpy.mockRestore();
		}
	};
}

export function createOAuthProviderConfig(overrides: Record<string, unknown> = {}) {
	return {
		id: 'provider-1',
		name: 'Provider',
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
		scopes: 'openid profile email',
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides
	};
}

export function createArcticProviderMocks(options: ArcticMockOptions = {}) {
	return {
		Google: class MockGoogle {
			createAuthorizationURL(state: string, verifier: string, scopes: string[]) {
				return new URL(
					`https://accounts.google.com/o/oauth2/auth?state=${state}&verifier=${encodeURIComponent(verifier)}&scope=${scopes.join(',')}`
				);
			}
			async validateAuthorizationCode() {
				if (options.google?.shouldThrow?.()) throw new Error('invalid_grant');
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
	};
}

export function createJoseMocks(options: JoseMockOptions = {}) {
	return {
		createRemoteJWKSet: () => 'mock-jwks',
		jwtVerify: async () => ({ payload: {}, protectedHeader: {} }),
		decodeJwt:
			options.decodeJwt ??
			(() => ({
				sub: 'user-123',
				email: 'user@example.com',
				email_verified: true,
				name: 'Test User',
				preferred_username: 'testuser',
				groups: ['admin', 'developers']
			}))
	};
}

export type OAuthProviderConfig = ReturnType<typeof createOAuthProviderConfig>;
