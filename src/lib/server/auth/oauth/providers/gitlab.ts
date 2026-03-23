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
import { generateCodeChallenge } from '$lib/server/auth/pkce';
import { logger } from '$lib/server/logger.js';

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
		logger.error(error, `[GitLabProvider] Failed to fetch groups for provider ${providerId}`);
		return [];
	}
}

/**
 * GitLab OAuth2 Provider Factory
 * Supports both GitLab.com and self-hosted GitLab instances.
 */
export function GitLabProvider(options: OAuthProviderOptions): IOAuthProvider {
	const config = options.config;
	const redirectUri = options.redirectUri || `/api/v1/auth/${config.id}/callback`;

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
		 * Generate authorization URL.
		 * Appends PKCE challenge params when a verifier is provided (GitLab supports PKCE since v13.7).
		 */
		async getAuthorizationUrl(state: string, codeVerifier?: string): Promise<URL> {
			const client = getClient();

			// Default scopes for GitLab
			const scopes = config.scopes
				? config.scopes.split(' ').filter(Boolean)
				: ['read_user', 'openid', 'profile', 'email'];

			// Add read_api scope if role mapping is configured (required for /api/v4/groups access)
			if (config.roleMapping && !scopes.includes('api') && !scopes.includes('read_api')) {
				scopes.push('read_api');
			}

			const url = await client.createAuthorizationURL(state, scopes);

			// Arctic's GitLab class doesn't expose PKCE params — append them manually.
			if (codeVerifier) {
				url.searchParams.set('code_challenge', generateCodeChallenge(codeVerifier));
				url.searchParams.set('code_challenge_method', 'S256');
			}

			return url;
		},

		/**
		 * Exchange authorization code for access token.
		 * Uses a raw token exchange when a PKCE verifier is present, since Arctic's GitLab
		 * class doesn't accept a code_verifier in its validateAuthorizationCode method.
		 */
		async validateCallback(code: string, codeVerifier?: string): Promise<OAuthTokens> {
			if (codeVerifier) {
				const clientSecret = decryptSecret(config.clientSecretEncrypted);
				const credentials = Buffer.from(`${config.clientId}:${clientSecret}`).toString('base64');
				const tokenEndpoint = `${baseURL}/oauth/token`;

				const body = new URLSearchParams({
					grant_type: 'authorization_code',
					code,
					redirect_uri: redirectUri,
					code_verifier: codeVerifier
				});

				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 10_000);

				try {
					const response = await fetch(tokenEndpoint, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/x-www-form-urlencoded',
							Accept: 'application/json',
							Authorization: `Basic ${credentials}`
						},
						body: body.toString(),
						signal: controller.signal
					});
					clearTimeout(timeoutId);

					if (!response.ok) {
						throw new Error(`HTTP ${response.status}: ${await response.text()}`);
					}

					const data = await response.json();

					return {
						accessToken: data.access_token,
						refreshToken: data.refresh_token,
						expiresIn: typeof data.expires_in === 'number' ? data.expires_in : undefined,
						tokenType: data.token_type ?? 'Bearer'
					};
				} catch (error) {
					clearTimeout(timeoutId);
					throw new OAuthError(
						`Failed to exchange code for token: ${error instanceof Error ? error.message : 'Unknown error'}`,
						'TOKEN_EXCHANGE_FAILED',
						error
					);
				}
			}

			// No PKCE — use Arctic's client as before
			const client = getClient();
			try {
				const tokens = await client.validateAuthorizationCode(code);
				return {
					accessToken: tokens.accessToken(),
					refreshToken: tokens.hasRefreshToken() ? tokens.refreshToken() : undefined,
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
		 * Refresh an expired access token using a GitLab refresh token
		 */
		async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
			const clientSecret = decryptSecret(config.clientSecretEncrypted);
			const credentials = Buffer.from(`${config.clientId}:${clientSecret}`).toString('base64');
			const tokenEndpoint = `${baseURL}/oauth/token`;

			const body = new URLSearchParams({
				grant_type: 'refresh_token',
				refresh_token: refreshToken
			});

			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 10_000);

			try {
				const response = await fetch(tokenEndpoint, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
						Accept: 'application/json',
						Authorization: `Basic ${credentials}`
					},
					body: body.toString(),
					signal: controller.signal
				});
				clearTimeout(timeoutId);

				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${await response.text()}`);
				}

				const data = await response.json();

				if (!data.access_token) {
					throw new Error('Missing access_token in GitLab refresh response');
				}

				return {
					accessToken: data.access_token,
					refreshToken: data.refresh_token,
					expiresIn: typeof data.expires_in === 'number' ? data.expires_in : undefined,
					tokenType: data.token_type ?? 'Bearer'
				};
			} catch (error) {
				clearTimeout(timeoutId);
				throw new OAuthError(
					`Failed to refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`,
					'TOKEN_REFRESH_FAILED',
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
					groups = await fetchGitLabGroups(
						baseURL,
						tokens.accessToken,
						user.id.toString(),
						config.id
					);
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
