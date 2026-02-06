/**
 * Google OAuth Provider
 * Google uses OIDC, so this is a thin wrapper around OIDCProvider
 * with Google-specific defaults.
 *
 * Scopes:
 * - openid - Required for OIDC
 * - profile - User profile (name, picture)
 * - email - Email address
 */

import { Google } from 'arctic';
import type { IOAuthProvider, OAuthTokens, OAuthUserInfo, OAuthProviderOptions } from '../types';
import { OAuthError } from '../types';
import { decryptSecret } from '$lib/server/auth/crypto';
import { OIDCProvider } from './oidc';

/**
 * Google-specific implementation using Arctic's Google client
 * Falls back to OIDC provider for flexibility
 */
export class GoogleProvider implements IOAuthProvider {
	public readonly config;
	private readonly redirectUri: string;
	private client: Google | null = null;
	private oidcProvider: OIDCProvider | null = null;

	// Google's OIDC issuer
	private static readonly ISSUER = 'https://accounts.google.com';

	constructor(options: OAuthProviderOptions) {
		this.config = options.config;
		this.redirectUri = options.redirectUri || `/api/auth/${this.config.id}/callback`;

		// Ensure issuerUrl is set for Google
		if (!this.config.issuerUrl) {
			this.config.issuerUrl = GoogleProvider.ISSUER;
		}
	}

	/**
	 * Get or create Google client (using Arctic library)
	 */
	private getClient(): Google {
		if (this.client) {
			return this.client;
		}

		const clientSecret = decryptSecret(this.config.clientSecretEncrypted);

		this.client = new Google(this.config.clientId, clientSecret, this.redirectUri);

		return this.client;
	}

	/**
	 * Get OIDC provider fallback (for userinfo endpoint)
	 */
	private getOIDCProvider(): OIDCProvider {
		if (this.oidcProvider) {
			return this.oidcProvider;
		}

		this.oidcProvider = new OIDCProvider({
			config: this.config,
			redirectUri: this.redirectUri
		});

		return this.oidcProvider;
	}

	/**
	 * Generate authorization URL using Arctic's Google client
	 */
	async getAuthorizationUrl(state: string, codeVerifier?: string): Promise<URL> {
		const client = this.getClient();

		// Parse scopes
		const scopes = this.config.scopes.split(' ').filter(Boolean);

		// Ensure required scopes
		const requiredScopes = ['openid', 'profile', 'email'];
		for (const scope of requiredScopes) {
			if (!scopes.includes(scope)) {
				scopes.push(scope);
			}
		}

		// Google requires a code verifier for PKCE (always enabled)
		const verifier = codeVerifier || '';

		return client.createAuthorizationURL(state, verifier, scopes);
	}

	/**
	 * Exchange authorization code for tokens using Arctic
	 */
	async validateCallback(code: string, codeVerifier?: string): Promise<OAuthTokens> {
		const client = this.getClient();
		const verifier = codeVerifier || '';

		try {
			const tokens = await client.validateAuthorizationCode(code, verifier);

			return {
				accessToken: tokens.accessToken(),
				refreshToken: tokens.refreshToken(), // May be undefined
				idToken: tokens.idToken(), // Google returns ID token
				tokenType: 'Bearer',
				expiresIn: tokens.accessTokenExpiresAt()
					? Math.floor((tokens.accessTokenExpiresAt()!.getTime() - Date.now()) / 1000)
					: undefined
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
	 * Get user info from Google
	 * Uses OIDC provider's getUserInfo for consistency
	 */
	async getUserInfo(tokens: OAuthTokens): Promise<OAuthUserInfo> {
		try {
			const oidcProvider = this.getOIDCProvider();
			const userInfo = await oidcProvider.getUserInfo(tokens);

			// Google-specific: Extract HD (hosted domain) claim if present
			// This can be used for domain restrictions (e.g., only allow @company.com)
			const rawClaims = userInfo as Record<string, unknown>;
			if (rawClaims.hd) {
				// Store hosted domain in groups for potential role mapping
				userInfo.groups = userInfo.groups || [];
				userInfo.groups.push(`domain:${rawClaims.hd}`);
			}

			return userInfo;
		} catch (error) {
			throw new OAuthError(
				`Failed to fetch user info: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'USERINFO_FAILED',
				error
			);
		}
	}
}
