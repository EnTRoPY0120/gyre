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

import { redirect } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { createOAuthLoginUrl, handleOAuthLoginError } from './oauth-login-flow.js';

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
import { tryCheckRateLimit } from '$lib/server/rate-limiter';

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

		throw redirect(302, await createOAuthLoginUrl(providerId, cookies));
	} catch (err) {
		handleOAuthLoginError(err);
	}
};
