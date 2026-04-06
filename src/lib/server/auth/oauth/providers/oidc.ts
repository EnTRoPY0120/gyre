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
import { assertSafeIssuerUrl, assertSafeOidcDiscoveryDocument } from '../url-security';

/**
 * In-memory cache for OIDC discovery documents
 * TTL: 1 hour (discovery endpoints rarely change)
 * Bounded to MAX_CACHE_SIZE entries; evicts expired then oldest-first when full.
 */
const MAX_CACHE_SIZE = 50;
const DISCOVERY_TTL_MS = 60 * 60 * 1000; // 1 hour
const REQUEST_TIMEOUT_MS = 10_000;
const discoveryCache = new Map<
	string,
	{
		discovery: OIDCDiscovery;
		expiresAt: number;
	}
>();

function normalizeIssuerUrl(issuerUrl: string): string {
	const issuer = assertSafeIssuerUrl(issuerUrl);
	const pathname = issuer.pathname.replace(/\/+$/, '');
	return `${issuer.origin}${pathname}`;
}

function setDiscoveryCache(issuer: string, discovery: OIDCDiscovery): void {
	const now = Date.now();
	// Sweep expired entries first
	for (const [key, entry] of discoveryCache) {
		if (now >= entry.expiresAt) discoveryCache.delete(key);
	}
	// If still at capacity, evict oldest (Map insertion order)
	if (discoveryCache.size >= MAX_CACHE_SIZE) {
		const oldest = discoveryCache.keys().next().value;
		if (oldest !== undefined) discoveryCache.delete(oldest);
	}
	discoveryCache.set(issuer, { discovery, expiresAt: now + DISCOVERY_TTL_MS });
}

export class OIDCProvider implements IOAuthProvider {
	public readonly config;
	private readonly redirectUri: string;
	private readonly normalizedIssuer: string;

	constructor(options: OAuthProviderOptions) {
		this.config = options.config;
		this.redirectUri = options.redirectUri || `/api/v1/auth/${this.config.id}/callback`;

		if (!this.config.issuerUrl?.trim()) {
			throw new OAuthError('OIDC provider requires issuerUrl', 'INVALID_CONFIG');
		}

		try {
			this.normalizedIssuer = normalizeIssuerUrl(this.config.issuerUrl);
		} catch (error) {
			throw new OAuthError(
				error instanceof Error ? error.message : 'OIDC issuer URL is invalid',
				'INVALID_CONFIG',
				error
			);
		}
	}

	/**
	 * Discover OIDC configuration from .well-known endpoint
	 * Results are cached for 1 hour.
	 */
	private async discover(): Promise<OIDCDiscovery> {
		const issuer = this.normalizedIssuer;

		// Check cache
		const cached = discoveryCache.get(issuer);
		if (cached && Date.now() < cached.expiresAt) {
			return cached.discovery;
		}

		// Fetch discovery document
		const discoveryUrl = issuer.endsWith('/')
			? `${issuer}.well-known/openid-configuration`
			: `${issuer}/.well-known/openid-configuration`;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

		try {
			const response = await fetch(discoveryUrl, {
				redirect: 'error',
				signal: controller.signal
			});
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const discovery = (await response.json()) as OIDCDiscovery;

			// Validate required fields
			if (!discovery.authorization_endpoint || !discovery.token_endpoint || !discovery.jwks_uri) {
				throw new Error('Invalid discovery document: missing required endpoints');
			}

			assertSafeOidcDiscoveryDocument(discovery, issuer);

			setDiscoveryCache(issuer, discovery);

			return discovery;
		} catch (error) {
			throw new OAuthError(
				`Failed to discover OIDC configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'DISCOVERY_FAILED',
				error
			);
		} finally {
			clearTimeout(timeoutId);
		}
	}

	/**
	 * Generate authorization URL
	 * PKCE is mandatory for OIDC flows — code_verifier must be provided
	 */
	async getAuthorizationUrl(state: string, codeVerifier?: string): Promise<URL> {
		// PKCE is mandatory — reject requests without a verifier
		if (!codeVerifier) {
			throw new Error('PKCE code verifier required');
		}

		const discovery = await this.discover();
		const scopes = this.config.scopes.split(' ').filter(Boolean);

		// Build authorization URL
		const url = new URL(discovery.authorization_endpoint);
		url.searchParams.set('client_id', this.config.clientId);
		url.searchParams.set('redirect_uri', this.redirectUri);
		url.searchParams.set('response_type', 'code');
		url.searchParams.set('scope', scopes.join(' '));
		url.searchParams.set('state', state);

		// Add PKCE challenge and method
		const challenge = generateCodeChallenge(codeVerifier);
		url.searchParams.set('code_challenge', challenge);
		url.searchParams.set('code_challenge_method', 'S256');

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
		// PKCE is mandatory — reject requests without a verifier
		if (!codeVerifier) {
			throw new Error('PKCE code verifier required');
		}

		const discovery = await this.discover();
		const clientSecret = decryptSecret(this.config.clientSecretEncrypted);

		// Prepare token request
		const body = new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			redirect_uri: redirectUri || this.redirectUri,
			client_id: this.config.clientId,
			client_secret: clientSecret,
			code_verifier: codeVerifier
		});

		// Exchange code for token
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

		try {
			const response = await fetch(discovery.token_endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Accept: 'application/json'
				},
				body: body.toString(),
				signal: controller.signal,
				redirect: 'error'
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`HTTP ${response.status}: ${errorText}`);
			}

			const data = await response.json();

			// Check for OAuth error response (HTTP 200 but error in body)
			if (data.error) {
				throw new Error(
					`${data.error}${data.error_description ? `: ${data.error_description}` : ''}`
				);
			}

			// Validate access token exists
			if (!data.access_token) {
				throw new Error('Missing access_token in OIDC token response');
			}

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
			if (error instanceof OAuthError) {
				throw error;
			}

			throw new OAuthError(
				`Failed to exchange code for token: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'TOKEN_EXCHANGE_FAILED',
				error
			);
		} finally {
			clearTimeout(timeoutId);
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
				issuer: this.normalizedIssuer,
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
			throw new OAuthError('No ID token and no userinfo endpoint available', 'NO_USER_INFO');
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

		try {
			const response = await fetch(discovery.userinfo_endpoint, {
				headers: {
					Authorization: `Bearer ${tokens.accessToken}`
				},
				signal: controller.signal,
				redirect: 'error'
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
		} finally {
			clearTimeout(timeoutId);
		}
	}

	/**
	 * Refresh an expired access token using the refresh token
	 */
	async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
		const discovery = await this.discover();
		const clientSecret = decryptSecret(this.config.clientSecretEncrypted);

		const body = new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: refreshToken,
			client_id: this.config.clientId,
			client_secret: clientSecret
		});

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

		try {
			const response = await fetch(discovery.token_endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Accept: 'application/json'
				},
				body: body.toString(),
				signal: controller.signal,
				redirect: 'error'
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`HTTP ${response.status}: ${errorText}`);
			}

			const data = await response.json();

			// Check for OAuth error response (HTTP 200 but error in body)
			if (data.error) {
				throw new Error(
					`${data.error}${data.error_description ? `: ${data.error_description}` : ''}`
				);
			}

			// Validate access token exists
			if (!data.access_token) {
				throw new Error('Missing access_token in OIDC token response');
			}

			// Validate the refreshed ID token before trusting it
			if (data.id_token) {
				await this.validateIdToken(data.id_token);
			}

			return {
				accessToken: data.access_token,
				refreshToken: data.refresh_token ?? refreshToken, // Some IdPs don't rotate refresh tokens
				idToken: data.id_token,
				tokenType: data.token_type || 'Bearer',
				expiresIn: data.expires_in,
				scope: data.scope
			};
		} catch (error) {
			if (error instanceof OAuthError) {
				throw error;
			}

			throw new OAuthError(
				`Failed to refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'TOKEN_REFRESH_FAILED',
				error
			);
		} finally {
			clearTimeout(timeoutId);
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
			locale: claims.locale as string | undefined,
			rawClaims: { ...claims }
		};

		// Extract groups/roles from configured claim
		const groupsClaim = claims[this.config.roleClaim];
		if (groupsClaim) {
			if (Array.isArray(groupsClaim)) {
				userInfo.groups = groupsClaim.filter((g): g is string => typeof g === 'string');
			} else if (typeof groupsClaim === 'string') {
				userInfo.groups = [groupsClaim];
			}
		}

		// Include all claims for custom extraction
		const normalizedUserInfo = Object.fromEntries(
			Object.entries(userInfo).filter(([, value]) => value !== undefined)
		) as OAuthUserInfo;

		const reservedKeys = new Set([
			...Object.keys(normalizedUserInfo),
			this.config.roleClaim,
			'groups',
			'rawClaims'
		]);
		const passthroughClaims = Object.fromEntries(
			Object.entries(claims).filter(([key]) => !reservedKeys.has(key))
		);

		return { ...passthroughClaims, ...normalizedUserInfo };
	}
}
