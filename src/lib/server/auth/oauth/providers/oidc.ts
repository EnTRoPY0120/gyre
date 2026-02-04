/**
 * OpenID Connect (OIDC) Provider
 * Supports any OIDC-compliant identity provider with auto-discovery.
 *
 * Compatible providers:
 * - Google
 * - Okta
 * - Auth0
 * - Keycloak
 * - Azure AD / Microsoft Entra ID
 * - Generic OIDC providers
 */

import * as jose from 'jose';
import type {
	IOAuthProvider,
	OAuthTokens,
	OAuthUserInfo,
	OIDCDiscovery,
	OAuthProviderOptions
} from '../types';
import { OAuthError } from '../types';
import { generateCodeChallenge } from '$lib/server/auth/pkce';
import { decryptSecret } from '$lib/server/auth/crypto';

/**
 * In-memory cache for OIDC discovery documents
 * TTL: 1 hour (discovery endpoints rarely change)
 */
const discoveryCache = new Map<
	string,
	{
		discovery: OIDCDiscovery;
		expiresAt: number;
	}
>();

export class OIDCProvider implements IOAuthProvider {
	public readonly config;
	private readonly redirectUri: string;

	constructor(options: OAuthProviderOptions) {
		this.config = options.config;
		this.redirectUri =
			options.redirectUri || `/api/auth/${this.config.id}/callback`;

		if (!this.config.issuerUrl) {
			throw new OAuthError(
				'OIDC provider requires issuerUrl',
				'INVALID_CONFIG'
			);
		}
	}

	/**
	 * Discover OIDC configuration from .well-known endpoint
	 * Results are cached for 1 hour.
	 */
	private async discover(): Promise<OIDCDiscovery> {
		const issuer = this.config.issuerUrl!;

		// Check cache
		const cached = discoveryCache.get(issuer);
		if (cached && Date.now() < cached.expiresAt) {
			return cached.discovery;
		}

		// Fetch discovery document
		const discoveryUrl = issuer.endsWith('/')
			? `${issuer}.well-known/openid-configuration`
			: `${issuer}/.well-known/openid-configuration`;

		try {
			const response = await fetch(discoveryUrl);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const discovery = (await response.json()) as OIDCDiscovery;

			// Validate required fields
			if (
				!discovery.authorization_endpoint ||
				!discovery.token_endpoint ||
				!discovery.jwks_uri
			) {
				throw new Error('Invalid discovery document: missing required endpoints');
			}

			// Cache for 1 hour
			discoveryCache.set(issuer, {
				discovery,
				expiresAt: Date.now() + 60 * 60 * 1000
			});

			return discovery;
		} catch (error) {
			throw new OAuthError(
				`Failed to discover OIDC configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'DISCOVERY_FAILED',
				error
			);
		}
	}

	/**
	 * Generate authorization URL
	 */
	async getAuthorizationUrl(state: string, codeVerifier?: string): Promise<URL> {
		const discovery = await this.discover();
		const scopes = this.config.scopes.split(' ').filter(Boolean);

		// Build authorization URL
		const url = new URL(discovery.authorization_endpoint);
		url.searchParams.set('client_id', this.config.clientId);
		url.searchParams.set('redirect_uri', this.redirectUri);
		url.searchParams.set('response_type', 'code');
		url.searchParams.set('scope', scopes.join(' '));
		url.searchParams.set('state', state);

		// Add PKCE if enabled
		if (this.config.usePkce && codeVerifier) {
			const challenge = generateCodeChallenge(codeVerifier);
			url.searchParams.set('code_challenge', challenge);
			url.searchParams.set('code_challenge_method', 'S256');
		}

		return url;
	}

	/**
	 * Exchange authorization code for tokens
	 */
	async validateCallback(
		code: string,
		codeVerifier?: string,
		redirectUri?: string
	): Promise<OAuthTokens> {
		const discovery = await this.discover();
		const clientSecret = decryptSecret(this.config.clientSecretEncrypted);

		// Prepare token request
		const body = new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			redirect_uri: redirectUri || this.redirectUri,
			client_id: this.config.clientId,
			client_secret: clientSecret
		});

		// Add PKCE if enabled
		if (this.config.usePkce && codeVerifier) {
			body.set('code_verifier', codeVerifier);
		}

		// Exchange code for token
		try {
			const response = await fetch(discovery.token_endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Accept: 'application/json'
				},
				body: body.toString()
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`HTTP ${response.status}: ${errorText}`);
			}

			const data = await response.json();

			// Validate ID token if present
			if (data.id_token) {
				await this.validateIdToken(data.id_token);
			}

			return {
				accessToken: data.access_token,
				refreshToken: data.refresh_token,
				idToken: data.id_token,
				tokenType: data.token_type || 'Bearer',
				expiresIn: data.expires_in,
				scope: data.scope
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
	 * Validate ID token (JWT) signature and claims
	 */
	private async validateIdToken(idToken: string): Promise<void> {
		try {
			const discovery = await this.discover();
			const JWKS = jose.createRemoteJWKSet(new URL(discovery.jwks_uri));

			await jose.jwtVerify(idToken, JWKS, {
				issuer: this.config.issuerUrl || undefined,
				audience: this.config.clientId,
				clockTolerance: 30 // 30 seconds clock skew tolerance
			});
		} catch (error) {
			throw new OAuthError(
				`ID token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'INVALID_ID_TOKEN',
				error
			);
		}
	}

	/**
	 * Get user info from ID token or userinfo endpoint
	 */
	async getUserInfo(tokens: OAuthTokens): Promise<OAuthUserInfo> {
		// If we have an ID token, extract claims from it
		if (tokens.idToken) {
			const claims = jose.decodeJwt(tokens.idToken);
			return this.mapClaimsToUserInfo(claims);
		}

		// Otherwise, fetch from userinfo endpoint
		const discovery = await this.discover();
		if (!discovery.userinfo_endpoint) {
			throw new OAuthError(
				'No ID token and no userinfo endpoint available',
				'NO_USER_INFO'
			);
		}

		try {
			const response = await fetch(discovery.userinfo_endpoint, {
				headers: {
					Authorization: `Bearer ${tokens.accessToken}`
				}
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const claims = await response.json();
			return this.mapClaimsToUserInfo(claims);
		} catch (error) {
			throw new OAuthError(
				`Failed to fetch user info: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'USERINFO_FAILED',
				error
			);
		}
	}

	/**
	 * Map OIDC claims to OAuthUserInfo
	 */
	private mapClaimsToUserInfo(claims: Record<string, unknown>): OAuthUserInfo {
		// Extract standard OIDC claims
		const userInfo: OAuthUserInfo = {
			sub: claims.sub as string,
			email: claims.email as string | undefined,
			emailVerified: claims.email_verified as boolean | undefined,
			username:
				(claims[this.config.usernameClaim] as string | undefined) ||
				(claims.preferred_username as string | undefined) ||
				(claims.email as string | undefined),
			name: claims.name as string | undefined,
			givenName: claims.given_name as string | undefined,
			familyName: claims.family_name as string | undefined,
			picture: claims.picture as string | undefined,
			locale: claims.locale as string | undefined
		};

		// Extract groups/roles from configured claim
		const groupsClaim = claims[this.config.roleClaim];
		if (groupsClaim) {
			if (Array.isArray(groupsClaim)) {
				userInfo.groups = groupsClaim.filter(
					(g): g is string => typeof g === 'string'
				);
			} else if (typeof groupsClaim === 'string') {
				userInfo.groups = [groupsClaim];
			}
		}

		// Include all claims for custom extraction
		return { ...userInfo, ...claims };
	}
}
