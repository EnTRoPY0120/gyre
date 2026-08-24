import { error, isHttpError, isRedirect } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';
import { generateCodeVerifier, generateState } from '$lib/server/auth/pkce';
import { DEFAULT_COOKIE_OPTIONS } from '$lib/server/config';
import { getOAuthProvider, OAuthError } from '$lib/server/auth/oauth';
import { logger } from '$lib/server/logger.js';

const STATE_COOKIE_MAX_AGE = 60 * 10;

export interface OAuthLoginDependencies {
	getProvider: typeof getOAuthProvider;
	generateState: typeof generateState;
	generateCodeVerifier: typeof generateCodeVerifier;
}

const defaultDependencies: OAuthLoginDependencies = {
	getProvider: getOAuthProvider,
	generateState,
	generateCodeVerifier
};

/** Generate the provider authorization URL and persist the one-time PKCE state. */
export async function createOAuthLoginUrl(
	providerId: string,
	cookies: Pick<Cookies, 'set'>,
	dependencies: OAuthLoginDependencies = defaultDependencies
): Promise<string> {
	const provider = await dependencies.getProvider(providerId);
	const state = dependencies.generateState();
	const codeVerifier = dependencies.generateCodeVerifier();

	cookies.set(`oauth_state_${providerId}`, state, {
		...DEFAULT_COOKIE_OPTIONS,
		maxAge: STATE_COOKIE_MAX_AGE
	});
	cookies.set(`oauth_verifier_${providerId}`, codeVerifier, {
		...DEFAULT_COOKIE_OPTIONS,
		maxAge: STATE_COOKIE_MAX_AGE
	});

	const authorizationUrl = await provider.getAuthorizationUrl(state, codeVerifier);
	return authorizationUrl.toString();
}

/** Translate OAuth provider failures into the public login endpoint contract. */
export function handleOAuthLoginError(err: unknown): never {
	if (isHttpError(err) || isRedirect(err)) throw err;

	logger.error(err, 'OAuth login error:');
	if (err instanceof OAuthError) {
		if (err.code === 'PROVIDER_NOT_FOUND') {
			throw error(404, { message: 'Authentication provider not found' });
		}
		if (err.code === 'PROVIDER_DISABLED') {
			throw error(403, { message: 'Authentication provider is disabled' });
		}
		throw error(500, { message: `OAuth error: ${err.message}` });
	}

	throw error(500, { message: 'Failed to initiate login' });
}
