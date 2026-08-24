import { error, redirect } from '@sveltejs/kit';
import { cleanupSetupTokenFile } from '$lib/server/auth';
import {
	createBetterAuthSessionForUser,
	ensureBetterAuthOAuthAccount
} from '$lib/server/auth/better-auth';
import { getOAuthProvider } from '$lib/server/auth/oauth';
import { createOrUpdateSSOUser } from '$lib/server/auth/sso';
import { tryCheckRateLimit } from '$lib/server/rate-limiter';
import { logger } from '$lib/server/logger.js';
import { getSsoLoginErrorMessage } from '$lib/server/auth/oauth/callback-helpers.js';
import type { RequestEvent } from './$types';

/** Execute the OAuth callback after the route has entered its error boundary. */
export async function handleOAuthCallback(event: RequestEvent): Promise<never> {
	const { params, url, cookies, request, getClientAddress, setHeaders } = event;
	const { providerId } = params;

	const ipAddress = getClientAddress();
	const rateLimit = tryCheckRateLimit({ setHeaders }, `oauth_callback:${ipAddress}`, 10, 60 * 1000);

	if (rateLimit.limited) {
		throw redirect(
			302,
			`/login?error=${encodeURIComponent(`Too many requests. Please try again in ${rateLimit.retryAfter} seconds.`)}`
		);
	}

	const code = url.searchParams.get('code');
	const returnedState = url.searchParams.get('state');
	const errorParam = url.searchParams.get('error');
	const errorDescription = url.searchParams.get('error_description');

	if (errorParam) {
		logger.error(
			new Error(errorDescription || errorParam || 'OAuth error'),
			'OAuth error from IdP:',
			errorParam
		);
		throw redirect(302, `/login?error=${encodeURIComponent(errorDescription || errorParam)}`);
	}

	if (!code || !returnedState) {
		throw error(400, { message: 'Missing code or state parameter' });
	}

	const storedState = cookies.get(`oauth_state_${providerId}`);
	if (!storedState || storedState !== returnedState) {
		logger.error(
			{ err: new Error('State mismatch: CSRF state validation failed') },
			'CSRF state validation failed'
		);
		throw error(400, { message: 'Invalid state parameter (possible CSRF attack)' });
	}

	const codeVerifier = cookies.get(`oauth_verifier_${providerId}`);
	cookies.delete(`oauth_state_${providerId}`, { path: '/' });
	if (codeVerifier) {
		cookies.delete(`oauth_verifier_${providerId}`, { path: '/' });
	}

	const provider = await getOAuthProvider(providerId);
	const redirectUri = `${url.origin}/api/v1/auth/${providerId}/callback`;
	const tokens = await provider.validateCallback(code, codeVerifier, redirectUri);
	const userInfo = await provider.getUserInfo(tokens);
	const result = await createOrUpdateSSOUser(providerId, userInfo, provider.config, tokens);

	if (!result.user) {
		throw redirect(
			302,
			`/login?error=${encodeURIComponent(getSsoLoginErrorMessage(result.reason))}`
		);
	}

	const user = result.user;
	if (!user.active) {
		throw redirect(
			302,
			`/login?error=${encodeURIComponent('Your account has been disabled. Please contact your administrator.')}`
		);
	}

	if (!result.accountLinked) {
		await ensureBetterAuthOAuthAccount(user.id, providerId, userInfo.sub, tokens);
	}
	await createBetterAuthSessionForUser(cookies, user.id, {
		ipAddress,
		userAgent: request.headers.get('user-agent') ?? undefined
	});
	cleanupSetupTokenFile();

	logger.info({ providerId, userId: user.id }, 'SSO login successful');
	throw redirect(302, '/');
}
