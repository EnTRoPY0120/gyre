/**
 * OAuth/OIDC Login Endpoint
 * Initiates the OAuth authorization flow by redirecting to the IdP.
 *
 * Flow:
 * 1. Load provider configuration from database
 * 2. Generate state (CSRF protection)
 * 3. Generate PKCE code verifier (if enabled)
 * 4. Store state & verifier in short-lived cookies
 * 5. Redirect user to IdP authorization URL
 */

import { redirect, error, isHttpError, isRedirect } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { getOAuthProvider, OAuthError } from '$lib/server/auth/oauth';

export const _metadata = {
	GET: {
		summary: 'Initiate OAuth/OIDC login',
		description:
			'Start the OAuth/OIDC authorization flow for the given provider. Redirects the user to the identity provider authorization URL. Rate limited to 10 requests per minute per IP.',
		tags: ['Auth'],
		security: [],
		request: {
			params: z.object({
				providerId: z.string().openapi({ example: 'my-oidc-provider' })
			})
		},
		responses: {
			302: { description: 'Redirect to identity provider authorization URL' },
			403: {
				description: 'Provider is disabled',
				content: { 'application/json': { schema: z.object({ message: z.string() }) } }
			},
			404: {
				description: 'Provider not found',
				content: { 'application/json': { schema: z.object({ message: z.string() }) } }
			},
			500: {
				description: 'Failed to initiate login',
				content: { 'application/json': { schema: z.object({ message: z.string() }) } }
			}
		}
	}
};
import { generateState, generateCodeVerifier } from '$lib/server/auth/pkce';
import { tryCheckRateLimit } from '$lib/server/rate-limiter';

// State cookie TTL: 10 minutes (enough time to complete OAuth flow)
const STATE_COOKIE_MAX_AGE = 60 * 10;

/**
 * GET /api/auth/[providerId]/login
 * Initiates OAuth login flow
 */
export const GET: RequestHandler = async (event) => {
	const { params, cookies, getClientAddress, setHeaders } = event;
	const { providerId } = params;

	try {
		// Rate limit: 10 attempts per minute per IP
		const ipAddress = getClientAddress();
		const rateLimit = tryCheckRateLimit({ setHeaders }, `oauth_login:${ipAddress}`, 10, 60 * 1000);

		if (rateLimit.limited) {
			throw redirect(
				302,
				`/login?error=${encodeURIComponent(`Too many requests. Please try again in ${rateLimit.retryAfter} seconds.`)}`
			);
		}

		// Get provider configuration and create OAuth client
		const provider = await getOAuthProvider(providerId);

		// Generate CSRF protection state
		const state = generateState();

		// Generate PKCE code verifier if enabled
		let codeVerifier: string | undefined;
		if (provider.config.usePkce) {
			codeVerifier = generateCodeVerifier();
		}

		// Store state in short-lived cookie
		cookies.set(`oauth_state_${providerId}`, state, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: STATE_COOKIE_MAX_AGE
		});

		// Store code verifier in short-lived cookie (if PKCE enabled)
		if (codeVerifier) {
			cookies.set(`oauth_verifier_${providerId}`, codeVerifier, {
				path: '/',
				httpOnly: true,
				secure: true,
				sameSite: 'lax',
				maxAge: STATE_COOKIE_MAX_AGE
			});
		}

		// Get authorization URL from provider
		const authUrl = await provider.getAuthorizationUrl(state, codeVerifier);

		// Redirect to IdP for authentication
		throw redirect(302, authUrl.toString());
	} catch (err) {
		if (isHttpError(err) || isRedirect(err)) {
			throw err;
		}

		console.error('OAuth login error:', err);

		// Handle OAuth-specific errors
		if (err instanceof OAuthError) {
			if (err.code === 'PROVIDER_NOT_FOUND') {
				throw error(404, { message: 'Authentication provider not found' });
			}
			if (err.code === 'PROVIDER_DISABLED') {
				throw error(403, { message: 'Authentication provider is disabled' });
			}
			throw error(500, { message: `OAuth error: ${err.message}` });
		}

		// Generic error
		throw error(500, { message: 'Failed to initiate login' });
	}
};
