/**
 * OAuth/OIDC Callback Endpoint
 * Handles the OAuth callback after user authenticates at IdP.
 *
 * Flow:
 * 1. Validate state parameter (CSRF protection)
 * 2. Extract authorization code
 * 3. Exchange code for access token
 * 4. Fetch user info from IdP
 * 5. Auto-provision user or find existing user
 * 6. Create session
 * 7. Set session cookie
 * 8. Redirect to home
 */

import { logger } from '$lib/server/logger.js';
import { redirect, error, isHttpError, isRedirect } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { getOAuthProvider, OAuthError } from '$lib/server/auth/oauth';

export const _metadata = {
	GET: {
		summary: 'OAuth/OIDC callback',
		description:
			'Handle the callback from the identity provider after user authentication. Validates the state parameter (CSRF protection), exchanges the authorization code for tokens, provisions/finds the user, creates a session, and redirects to the home page.',
		tags: ['Auth'],
		security: [],
		request: {
			params: z.object({
				providerId: z.string().openapi({ example: 'my-oidc-provider' })
			}),
			query: z.object({
				code: z.string().openapi({ description: 'Authorization code from identity provider' }),
				state: z.string().openapi({ description: 'CSRF state parameter' })
			})
		},
		responses: {
			302: { description: 'Redirect to home page on success, or login page with error on failure' },
			400: {
				description: 'Missing or invalid state/code parameters',
				content: { 'application/json': { schema: z.object({ message: z.string() }) } }
			},
			500: {
				description: 'Authentication failed',
				content: { 'application/json': { schema: z.object({ message: z.string() }) } }
			}
		}
	}
};
import { createOrUpdateSSOUser } from '$lib/server/auth/sso';
import { createSession, rotateSession, cleanupSetupTokenFile } from '$lib/server/auth';
import { DEFAULT_COOKIE_OPTIONS } from '$lib/server/config';
import { tryCheckRateLimit } from '$lib/server/rate-limiter';
import { computeStateFingerprint } from '$lib/server/auth/pkce';
import { encryptSecret } from '$lib/server/auth/crypto';
import { getDb } from '$lib/server/db';
import { userProviders } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';

/**
 * GET /api/auth/[providerId]/callback
 * Handles OAuth callback from IdP
 */
export const GET: RequestHandler = async (event) => {
	const { params, url, cookies, request, getClientAddress, setHeaders } = event;
	const { providerId } = params;

	try {
		// Rate limit: 10 attempts per minute per IP
		const ipAddress = getClientAddress();
		const rateLimit = tryCheckRateLimit(
			{ setHeaders },
			`oauth_callback:${ipAddress}`,
			10,
			60 * 1000
		);

		if (rateLimit.limited) {
			throw redirect(
				302,
				`/login?error=${encodeURIComponent(`Too many requests. Please try again in ${rateLimit.retryAfter} seconds.`)}`
			);
		}

		// Extract code and state from query parameters
		const code = url.searchParams.get('code');
		const returnedState = url.searchParams.get('state');
		const errorParam = url.searchParams.get('error');
		const errorDescription = url.searchParams.get('error_description');

		// Check for OAuth errors from IdP
		if (errorParam) {
			logger.error(
				new Error(errorDescription || errorParam || 'OAuth error'),
				'OAuth error from IdP:',
				errorParam
			);
			throw redirect(302, `/login?error=${encodeURIComponent(errorDescription || errorParam)}`);
		}

		// Validate required parameters
		if (!code || !returnedState) {
			throw error(400, { message: 'Missing code or state parameter' });
		}

		// Validate state (CSRF protection) with mandatory request fingerprint binding.
		// Cookie format: `state|sha256(ip|ua)` — both parts are required.
		const storedStateCookie = cookies.get(`oauth_state_${providerId}`);
		const pipeIndex = storedStateCookie?.lastIndexOf('|') ?? -1;
		const storedState = pipeIndex > -1 ? storedStateCookie!.slice(0, pipeIndex) : null;
		const storedFingerprint = pipeIndex > -1 ? storedStateCookie!.slice(pipeIndex + 1) : null;

		if (!storedFingerprint) {
			logger.error(
				{ providerId, err: new Error('Missing state fingerprint') },
				'OAuth state cookie is missing fingerprint'
			);
			throw error(400, { message: 'Invalid state parameter (possible CSRF attack)' });
		}

		if (!storedState || storedState !== returnedState) {
			logger.error(
				{ err: new Error('State mismatch: CSRF state validation failed') },
				'CSRF state validation failed'
			);
			throw error(400, { message: 'Invalid state parameter (possible CSRF attack)' });
		}

		// Verify request fingerprint — detects state cookie reuse across different sessions
		const currentFingerprint = computeStateFingerprint(
			ipAddress,
			request.headers.get('user-agent') ?? ''
		);
		if (storedFingerprint !== currentFingerprint) {
			logger.warn(
				{ providerId },
				'OAuth state fingerprint mismatch — possible session hijack attempt'
			);
			throw error(400, { message: 'Invalid state parameter (possible CSRF attack)' });
		}

		// Get code verifier (PKCE)
		const codeVerifier = cookies.get(`oauth_verifier_${providerId}`);

		// Clear state and verifier cookies (single-use)
		cookies.delete(`oauth_state_${providerId}`, { path: '/' });
		if (codeVerifier) {
			cookies.delete(`oauth_verifier_${providerId}`, { path: '/' });
		}

		// Get provider configuration and create OAuth client
		const provider = await getOAuthProvider(providerId);

		// Build redirect URI (this callback URL)
		const redirectUri = `${url.origin}/api/v1/auth/${providerId}/callback`;

		// Exchange authorization code for tokens
		const tokens = await provider.validateCallback(code, codeVerifier, redirectUri);

		// Fetch user information from IdP
		const userInfo = await provider.getUserInfo(tokens);

		// Auto-provision user or find existing user
		const result = await createOrUpdateSSOUser(providerId, userInfo, provider.config);

		// Check if user creation/retrieval was successful
		if (!result.user) {
			// Provide specific error message based on reason
			let message = 'Authentication failed. Please contact your administrator.';
			if (result.reason === 'signup_disabled') {
				message = 'New account registration is not available. Please contact your administrator.';
			} else if (result.reason === 'domain_not_allowed') {
				message = 'Your email domain is not authorized for this application.';
			} else if (result.reason === 'auto_provision_disabled') {
				message = 'Account auto-provisioning is disabled. Please contact your administrator.';
			} else if (result.reason === 'user_not_found') {
				message = 'Your user account could not be found. Please contact your administrator.';
			}

			throw redirect(302, `/login?error=${encodeURIComponent(message)}`);
		}

		const user = result.user;

		// Check if user account is active
		if (!user.active) {
			throw redirect(
				302,
				`/login?error=${encodeURIComponent('Your account has been disabled. Please contact your administrator.')}`
			);
		}

		// Store OAuth tokens encrypted at rest before minting the session.
		// Performing the DB write first ensures no live session exists if persistence fails.
		if (tokens.accessToken) {
			const db = await getDb();
			const tokenExpiresAt =
				tokens.expiresIn != null ? new Date(Date.now() + tokens.expiresIn * 1000) : null;

			await db
				.update(userProviders)
				.set({
					accessTokenEncrypted: encryptSecret(tokens.accessToken),
					refreshTokenEncrypted: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
					tokenExpiresAt
				})
				.where(and(eq(userProviders.userId, user.id), eq(userProviders.providerId, providerId)));
		}

		// Create or rotate session (rotation prevents session fixation attacks).
		// Session is only created after token persistence succeeds.
		const existingSessionId = cookies.get('gyre_session');
		const userAgent = request.headers.get('user-agent') ?? undefined;
		const sessionId = existingSessionId
			? await rotateSession(existingSessionId, user.id, ipAddress, userAgent)
			: await createSession(user.id, ipAddress, userAgent);
		cleanupSetupTokenFile();

		// Set session cookie
		cookies.set('gyre_session', sessionId, DEFAULT_COOKIE_OPTIONS);

		logger.info({ providerId, userId: user.id }, 'SSO login successful');

		// Redirect to home page
		throw redirect(302, '/');
	} catch (err) {
		// Re-throw SvelteKit errors (redirect, error)
		if (isHttpError(err) || isRedirect(err)) {
			throw err;
		}

		logger.error(err, 'OAuth callback error:');

		let errorMessage = 'Authentication failed';

		// Handle OAuth-specific errors
		if (err instanceof OAuthError) {
			if (err.code === 'PROVIDER_NOT_FOUND') {
				errorMessage = 'Authentication provider not found';
			} else if (err.code === 'PROVIDER_DISABLED') {
				errorMessage = 'Authentication provider is disabled';
			} else if (err.code === 'TOKEN_EXCHANGE_FAILED') {
				errorMessage = 'Failed to exchange authorization code for token';
			} else if (err.code === 'USERINFO_FAILED') {
				errorMessage = 'Failed to fetch user information from provider';
			} else if (err.code === 'INVALID_ID_TOKEN') {
				errorMessage = 'Invalid ID token from provider';
			} else {
				errorMessage = `OAuth error: ${err.message}`;
			}
		}

		// Redirect to login page with error message instead of showing error page
		throw redirect(302, `/login?error=${encodeURIComponent(errorMessage)}`);
	}
};
