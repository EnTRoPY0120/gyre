/**
 * GitLab OAuth2 Provider
 * Supports both GitLab.com and self-hosted GitLab instances.
 *
 * Scopes:
 * - read_user - Read user profile
 * - openid - OIDC support
 * - profile - User profile
 * - email - User email
 */

import { GitLab } from 'arctic';
import type { IOAuthProvider, OAuthTokens, OAuthUserInfo, OAuthProviderOptions } from '../types';
import { OAuthError } from '../types';
import { decryptSecret } from '$lib/server/auth/crypto';

interface GitLabUser {
	id: number;
	username: string;
	email?: string;
	name?: string;
	avatar_url?: string;
	state?: string;
	confirmed_at?: string; // ISO 8601 timestamp when email was confirmed
}

interface GitLabGroup {
	id: number;
	name: string;
	path: string;
	full_path: string;
}

/**
 * Fetch from GitLab API
 */
async function fetchGitLabAPI<T>(
	url: string,
	accessToken: string
): Promise<{ data: T; headers: Headers }> {
	// Add timeout to prevent hanging requests
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 10000);

	try {
		const response = await fetch(url, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: 'application/json'
			},
			signal: controller.signal
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`GitLab API error: ${response.status} ${errorText}`);
		}

		const data = (await response.json()) as T;
		return { data, headers: response.headers };
	} catch (error) {
		clearTimeout(timeoutId);
		throw error;
	}
}

/**
 * Fetch user's groups from GitLab API with full pagination
 */
async function fetchGitLabGroups(
	baseURL: string,
	accessToken: string,
	userSub: string,
	providerId: string
): Promise<string[]> {
	try {
		const allGroups: GitLabGroup[] = [];
		let nextPage: string | null = '1';

		// Loop calling /api/v4/groups?min_access_level=10&per_page=100 and follow pagination headers
		while (nextPage) {
			const gitLabGroupsUrl: string = `${baseURL}/api/v4/groups?min_access_level=10&per_page=100&page=${nextPage}`;
			const result: { data: GitLabGroup[]; headers: Headers } = await fetchGitLabAPI<GitLabGroup[]>(
				gitLabGroupsUrl,
				accessToken
			);

			allGroups.push(...result.data);

			// GitLab pagination headers: x-next-page or Link
			const next: string | null = result.headers.get('x-next-page');
			nextPage = next && next !== '' ? next : null;
		}

		return allGroups.map((g) => g.full_path);
	} catch (error) {
		// Structured log containing the provider ID and the user subject (user.sub) plus the error object
		console.error({
			message: 'Failed to fetch GitLab groups',
			providerId,
			userSub,
			error: error instanceof Error ? { message: error.message, stack: error.stack } : error
		});
		return [];
	}
}

/**
 * GitLab OAuth2 Provider Factory
 * Supports both GitLab.com and self-hosted GitLab instances.
 */
export function GitLabProvider(options: OAuthProviderOptions): IOAuthProvider {
	const config = options.config;
	const redirectUri = options.redirectUri || `/api/auth/${config.id}/callback`;

	// Default to gitlab.com if no issuer provided
	// Remove trailing slash if present
	const issuer = config.issuerUrl?.trim() || 'https://gitlab.com';
	const baseURL = issuer.endsWith('/') ? issuer.slice(0, -1) : issuer;

	let client: GitLab | null = null;

	/**
	 * Get or create GitLab client
	 */
	const getClient = (): GitLab => {
		if (client) {
			return client;
		}

		const clientSecret = decryptSecret(config.clientSecretEncrypted);

		client = new GitLab(baseURL, config.clientId, clientSecret, redirectUri);

		return client;
	};

	return {
		config,

		/**
		 * Generate authorization URL
		 */
		async getAuthorizationUrl(state: string, _codeVerifier?: string): Promise<URL> {
			const client = getClient();

			// GitLab in arctic doesn't support PKCE. Surface a warning if requested.
			if (config.usePkce) {
				console.warn(
					`[GitLabProvider] PKCE is enabled for provider "${config.id}", but GitLab provider silently ignores PKCE. This setting will be ignored.`
				);
			}

			// Default scopes for GitLab
			const scopes = config.scopes
				? config.scopes.split(' ').filter(Boolean)
				: ['read_user', 'openid', 'profile', 'email'];

			// Add read_api scope if role mapping is configured (required for /api/v4/groups access)
			if (config.roleMapping && !scopes.includes('api') && !scopes.includes('read_api')) {
				// Unconditionally add 'read_api' when role mapping is configured and neither 'api' nor 'read_api' are present.
				scopes.push('read_api');
			}

			// GitLab in arctic doesn't support PKCE parameters in createAuthorizationURL
			return await client.createAuthorizationURL(state, scopes);
		},

		/**
		 * Exchange authorization code for access token
		 */
		async validateCallback(code: string, _codeVerifier?: string): Promise<OAuthTokens> {
			const client = getClient();

			try {
				// GitLab in arctic doesn't support PKCE parameters in validateAuthorizationCode
				const tokens = await client.validateAuthorizationCode(code);

				return {
					accessToken: tokens.accessToken(),
					// Handle token expiration null-safely (GitLab may omit expires_in)
					expiresIn: tokens.accessTokenExpiresAt()
						? Math.floor((tokens.accessTokenExpiresAt()!.getTime() - Date.now()) / 1000)
						: undefined,
					tokenType: 'Bearer'
				};
			} catch (error) {
				throw new OAuthError(
					`Failed to exchange code for token: ${error instanceof Error ? error.message : 'Unknown error'}`,
					'TOKEN_EXCHANGE_FAILED',
					error
				);
			}
		},

		/**
		 * Fetch user information from GitLab API
		 */
		async getUserInfo(tokens: OAuthTokens): Promise<OAuthUserInfo> {
			try {
				// Fetch user profile from API
				const { data: user } = await fetchGitLabAPI<GitLabUser>(
					`${baseURL}/api/v4/user`,
					tokens.accessToken
				);

				// Fetch groups if role mapping is configured
				let groups: string[] = [];
				if (config.roleMapping) {
					groups = await fetchGitLabGroups(baseURL, tokens.accessToken, user.id.toString(), config.id);
				}

				return {
					sub: user.id.toString(),
					email: user.email,
					// Derive email verification from confirmed_at field
					// GitLab.com requires email verification, but self-hosted instances may not
					emailVerified: !!user.confirmed_at,
					username: user.username,
					name: user.name || user.username,
					picture: user.avatar_url,
					groups
				};
			} catch (error) {
				throw new OAuthError(
					`Failed to fetch user info: ${error instanceof Error ? error.message : 'Unknown error'}`,
					'USERINFO_FAILED',
					error
				);
			}
		}
	};
}
