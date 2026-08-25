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
import { redirect, isHttpError, isRedirect } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { getOAuthCallbackErrorMessage } from '$lib/server/auth/oauth/callback-helpers.js';
import { handleOAuthCallback } from './oauth-callback-flow';

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

/**
 * GET /api/auth/[providerId]/callback
 * Handles OAuth callback from IdP
 */
export const GET: RequestHandler = async (event) => {
	try {
		return await handleOAuthCallback(event);
	} catch (err) {
		// Re-throw SvelteKit errors (redirect, error)
		if (isHttpError(err) || isRedirect(err)) {
			throw err;
		}

		logger.error(err, 'OAuth callback error:');

		// Redirect to login page with error message instead of showing error page
		throw redirect(302, `/login?error=${encodeURIComponent(getOAuthCallbackErrorMessage(err))}`);
	}
};
