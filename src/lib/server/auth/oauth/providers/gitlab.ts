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

export class GitLabProvider implements IOAuthProvider {
	public readonly config;
	private readonly redirectUri: string;
	private client: GitLab | null = null;
	private readonly baseURL: string;

	constructor(options: OAuthProviderOptions) {
		this.config = options.config;
		this.redirectUri = options.redirectUri || `/api/auth/${this.config.id}/callback`;

		// Default to gitlab.com if no issuer provided
		// Remove trailing slash if present
		const issuer = this.config.issuerUrl?.trim() || 'https://gitlab.com';
		this.baseURL = issuer.endsWith('/') ? issuer.slice(0, -1) : issuer;
	}

	/**
	 * Get or create GitLab client
	 */
	private getClient(): GitLab {
		if (this.client) {
			return this.client;
		}

		const clientSecret = decryptSecret(this.config.clientSecretEncrypted);

		this.client = new GitLab(this.baseURL, this.config.clientId, clientSecret, this.redirectUri);

		return this.client;
	}

	/**
	 * Generate authorization URL
	 */
	async getAuthorizationUrl(state: string): Promise<URL> {
		const client = this.getClient();

		// Default scopes for GitLab
		const scopes = this.config.scopes
			? this.config.scopes.split(' ').filter(Boolean)
			: ['read_user', 'openid', 'profile', 'email'];

		return await client.createAuthorizationURL(state, scopes);
	}

	/**
	 * Exchange authorization code for access token
	 */
	async validateCallback(code: string): Promise<OAuthTokens> {
		const client = this.getClient();

		try {
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
	}

	/**
	 * Fetch user information from GitLab API
	 */
	async getUserInfo(tokens: OAuthTokens): Promise<OAuthUserInfo> {
		try {
			// Fetch user profile from API
			const user = await this.fetchGitLabAPI<GitLabUser>(
				`${this.baseURL}/api/v4/user`,
				tokens.accessToken
			);

			return {
				sub: user.id.toString(),
				email: user.email,
				// Derive email verification from confirmed_at field
				// GitLab.com requires email verification, but self-hosted instances may not
				emailVerified: !!user.confirmed_at,
				username: user.username,
				name: user.name || user.username,
				picture: user.avatar_url,
				groups: [] // Groups fetch to be implemented if needed
			};
		} catch (error) {
			throw new OAuthError(
				`Failed to fetch user info: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'USERINFO_FAILED',
				error
			);
		}
	}

	/**
	 * Fetch from GitLab API
	 */
	private async fetchGitLabAPI<T>(url: string, accessToken: string): Promise<T> {
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

			return response.json() as Promise<T>;
		} catch (error) {
			clearTimeout(timeoutId);
			throw error;
		}
	}
}
