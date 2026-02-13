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

import { redirect, error, isHttpError, isRedirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getOAuthProvider, OAuthError } from '$lib/server/auth/oauth';
import { createOrUpdateSSOUser } from '$lib/server/auth/sso';
import { createSession } from '$lib/server/auth';
import { tryCheckRateLimit } from '$lib/server/rate-limiter';

/**
 * GET /api/auth/[providerId]/callback
 * Handles OAuth callback from IdP
 */
export const GET: RequestHandler = async (event) => {
	const { params, url, cookies, getClientAddress, setHeaders } = event;
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
			console.error('OAuth error from IdP:', errorParam, errorDescription);
			throw redirect(302, `/login?error=${encodeURIComponent(errorDescription || errorParam)}`);
		}

		// Validate required parameters
		if (!code || !returnedState) {
			throw error(400, { message: 'Missing code or state parameter' });
		}

		// Validate state (CSRF protection)
		const storedState = cookies.get(`oauth_state_${providerId}`);
		if (!storedState || storedState !== returnedState) {
			console.error('State mismatch:', { stored: storedState, returned: returnedState });
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
		const redirectUri = `${url.origin}/api/auth/${providerId}/callback`;

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
			throw error(403, { message: 'Your account has been disabled.' });
		}

		// Create session for the user
		const sessionId = await createSession(user.id, ipAddress, undefined);

		// Set session cookie
		cookies.set('gyre_session', sessionId, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7 // 7 days
		});

		console.log(`SSO login successful for user ${user.username} (${user.email})`);

		// Redirect to home page
		throw redirect(302, '/');
	} catch (err) {
		// Re-throw SvelteKit errors (redirect, error)
		if (isHttpError(err) || isRedirect(err)) {
			throw err;
		}

		console.error('OAuth callback error:', err);

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
