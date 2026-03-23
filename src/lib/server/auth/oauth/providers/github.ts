/**
 * GitHub OAuth2 Provider
 * GitHub uses OAuth2 (not OIDC) with custom API endpoints.
 *
 * Scopes:
 * - read:user - Read user profile
 * - user:email - Read user email addresses
 * - read:org - Read organization membership (for role mapping)
 */

import { GitHub } from 'arctic';
import type { IOAuthProvider, OAuthTokens, OAuthUserInfo, OAuthProviderOptions } from '../types';
import { OAuthError } from '../types';
import { decryptSecret } from '$lib/server/auth/crypto';
import { generateCodeChallenge } from '$lib/server/auth/pkce';

interface GitHubUser {
	id: number;
	login: string;
	email?: string;
	name?: string;
	avatar_url?: string;
	type: string;
}

interface GitHubEmail {
	email: string;
	primary: boolean;
	verified: boolean;
	visibility: string | null;
}

interface GitHubOrg {
	login: string;
	id: number;
	description: string;
}

interface GitHubTeam {
	name: string;
	slug: string;
	organization: {
		login: string;
	};
}

export class GitHubProvider implements IOAuthProvider {
	public readonly config;
	private readonly redirectUri: string;
	private client: GitHub | null = null;

	constructor(options: OAuthProviderOptions) {
		this.config = options.config;
		this.redirectUri = options.redirectUri || `/api/v1/auth/${this.config.id}/callback`;
	}

	/**
	 * Get or create GitHub client (using Arctic library)
	 */
	private getClient(): GitHub {
		if (this.client) {
			return this.client;
		}

		const clientSecret = decryptSecret(this.config.clientSecretEncrypted);

		this.client = new GitHub(this.config.clientId, clientSecret, this.redirectUri);

		return this.client;
	}

	/**
	 * Generate authorization URL
	 * GitHub supports PKCE natively — appends challenge params when verifier is provided.
	 */
	async getAuthorizationUrl(state: string, codeVerifier?: string): Promise<URL> {
		const client = this.getClient();

		// Parse scopes (GitHub uses space-separated scopes)
		const scopes = this.config.scopes
			.split(' ')
			.filter(Boolean)
			.filter((s) => s !== 'openid' && s !== 'profile'); // Remove OIDC-specific scopes

		// Ensure we have user:email for email access
		if (!scopes.includes('user:email')) {
			scopes.push('user:email');
		}

		// Add read:org if role mapping is configured (for organization teams)
		if (this.config.roleMapping && !scopes.includes('read:org')) {
			scopes.push('read:org');
		}

		const url = client.createAuthorizationURL(state, scopes);

		// Arctic's GitHub class doesn't expose PKCE params — append them manually.
		// GitHub has supported PKCE since Oct 2023.
		if (codeVerifier) {
			url.searchParams.set('code_challenge', generateCodeChallenge(codeVerifier));
			url.searchParams.set('code_challenge_method', 'S256');
		}

		return url;
	}

	/**
	 * Exchange authorization code for access token
	 */
	async validateCallback(code: string, codeVerifier?: string): Promise<OAuthTokens> {
		if (codeVerifier) {
			// Arctic's GitHub.validateAuthorizationCode doesn't accept a code_verifier.
			// When PKCE is in use, do a raw exchange so the verifier reaches GitHub.
			const clientSecret = decryptSecret(this.config.clientSecretEncrypted);
			const credentials = Buffer.from(`${this.config.clientId}:${clientSecret}`).toString('base64');
			const body = new URLSearchParams({
				grant_type: 'authorization_code',
				code,
				redirect_uri: this.redirectUri,
				code_verifier: codeVerifier
			});

			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 10_000);

			try {
				const response = await fetch('https://github.com/login/oauth/access_token', {
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
				if (data.error) {
					throw new Error(data.error_description ?? data.error);
				}

				return {
					accessToken: data.access_token,
					tokenType: data.token_type ?? 'Bearer',
					scope: data.scope
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
		const client = this.getClient();
		try {
			const tokens = await client.validateAuthorizationCode(code);
			return {
				accessToken: tokens.accessToken(),
				tokenType: 'Bearer',
				scope: tokens.accessTokenExpiresAt()?.toString()
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
	 * Fetch user information from GitHub API
	 */
	async getUserInfo(tokens: OAuthTokens): Promise<OAuthUserInfo> {
		try {
			// Fetch user profile
			const user = await this.fetchGitHubAPI<GitHubUser>(
				'https://api.github.com/user',
				tokens.accessToken
			);

			// Fetch primary email (if not in profile)
			let email = user.email;
			if (!email) {
				const emails = await this.fetchGitHubAPI<GitHubEmail[]>(
					'https://api.github.com/user/emails',
					tokens.accessToken
				);
				const primaryEmail = emails.find((e) => e.primary && e.verified);
				email = primaryEmail?.email;
			}

			// Fetch organizations and teams for role mapping
			let groups: string[] = [];
			if (this.config.roleMapping) {
				groups = await this.fetchGroups(tokens.accessToken);
			}

			return {
				sub: user.id.toString(),
				email,
				emailVerified: true, // GitHub emails are verified
				username: user.login,
				name: user.name || user.login,
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

	/**
	 * Fetch organizations and teams for role mapping
	 * Returns groups in format: "org/team" or "org" (for org membership)
	 */
	private async fetchGroups(accessToken: string): Promise<string[]> {
		const groups: string[] = [];

		try {
			// Fetch organizations
			const orgs = await this.fetchGitHubAPI<GitHubOrg[]>(
				'https://api.github.com/user/orgs',
				accessToken
			);

			for (const org of orgs) {
				// Add organization membership
				groups.push(org.login);

				// Fetch teams within organization
				try {
					const teams = await this.fetchGitHubAPI<GitHubTeam[]>(
						`https://api.github.com/user/teams`,
						accessToken
					);

					// Filter teams for this org and add in format "org/team"
					teams
						.filter((t) => t.organization.login === org.login)
						.forEach((team) => {
							groups.push(`${org.login}/${team.slug}`);
						});
				} catch {
					// Teams endpoint might fail if user doesn't have read:org scope
					// Continue without teams
				}
			}
		} catch {
			// Orgs endpoint might fail - return empty groups
			return [];
		}

		return groups;
	}

	/**
	 * Fetch from GitHub API with error handling
	 */
	private async fetchGitHubAPI<T>(url: string, accessToken: string): Promise<T> {
		const response = await fetch(url, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: 'application/vnd.github+json',
				'X-GitHub-Api-Version': '2022-11-28',
				'User-Agent': 'Gyre-FluxCD-Dashboard'
			}
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`GitHub API error: ${response.status} ${errorText}`);
		}

		return response.json() as Promise<T>;
	}
}
