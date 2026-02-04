/**
 * OAuth2/OIDC Provider Types
 * Common interfaces and types used across all OAuth providers.
 */

import type { AuthProvider } from '$lib/server/db/schema';

/**
 * OAuth2 tokens returned from token endpoint
 */
export interface OAuthTokens {
	accessToken: string;
	refreshToken?: string;
	idToken?: string; // OIDC only
	tokenType: string; // Usually "Bearer"
	expiresIn?: number; // Seconds until expiry
	scope?: string;
}

/**
 * User information extracted from OAuth provider
 */
export interface OAuthUserInfo {
	/** Unique user ID from provider (sub claim for OIDC) */
	sub: string;

	/** Email address */
	email?: string;

	/** Email verified flag */
	emailVerified?: boolean;

	/** Username or preferred username */
	username?: string;

	/** Full name */
	name?: string;

	/** Given name (first name) */
	givenName?: string;

	/** Family name (last name) */
	familyName?: string;

	/** Profile picture URL */
	picture?: string;

	/** Groups or roles from IdP */
	groups?: string[];

	/** Locale/language */
	locale?: string;

	/** Raw claims from IdP (for custom claim extraction) */
	[key: string]: unknown;
}

/**
 * OIDC Discovery Document
 * https://openid.net/specs/openid-connect-discovery-1_0.html
 */
export interface OIDCDiscovery {
	issuer: string;
	authorization_endpoint: string;
	token_endpoint: string;
	userinfo_endpoint?: string;
	jwks_uri: string;
	scopes_supported?: string[];
	response_types_supported: string[];
	grant_types_supported?: string[];
	subject_types_supported: string[];
	id_token_signing_alg_values_supported: string[];
	claims_supported?: string[];
	code_challenge_methods_supported?: string[];
}

/**
 * OAuth Provider Interface
 * All OAuth/OIDC providers must implement this interface.
 */
export interface IOAuthProvider {
	/**
	 * Provider configuration from database
	 */
	readonly config: AuthProvider;

	/**
	 * Generate the authorization URL to redirect the user to the IdP.
	 *
	 * @param state - CSRF protection token
	 * @param codeVerifier - PKCE code verifier (if PKCE enabled)
	 * @returns Authorization URL to redirect user to
	 */
	getAuthorizationUrl(state: string, codeVerifier?: string): Promise<URL>;

	/**
	 * Exchange authorization code for access token.
	 *
	 * @param code - Authorization code from callback
	 * @param codeVerifier - PKCE code verifier (if PKCE enabled)
	 * @param redirectUri - Redirect URI used in authorization request
	 * @returns OAuth tokens (access, refresh, id tokens)
	 */
	validateCallback(code: string, codeVerifier?: string, redirectUri?: string): Promise<OAuthTokens>;

	/**
	 * Fetch user information from the IdP.
	 *
	 * @param tokens - OAuth tokens from validateCallback
	 * @returns User information extracted from IdP
	 */
	getUserInfo(tokens: OAuthTokens): Promise<OAuthUserInfo>;
}

/**
 * OAuth Provider Constructor Options
 */
export interface OAuthProviderOptions {
	config: AuthProvider;
	/** Optional: Override redirect URI (defaults to /api/auth/[providerId]/callback) */
	redirectUri?: string;
}

/**
 * OAuth Error
 */
export class OAuthError extends Error {
	constructor(
		message: string,
		public code: string,
		public details?: unknown
	) {
		super(message);
		this.name = 'OAuthError';
	}
}

/**
 * Provider type enum for type checking
 */
export enum ProviderType {
	OIDC = 'oidc',
	OAUTH2_GITHUB = 'oauth2-github',
	OAUTH2_GOOGLE = 'oauth2-google',
	OAUTH2_GITLAB = 'oauth2-gitlab',
	OAUTH2_GENERIC = 'oauth2-generic'
}
