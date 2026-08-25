import { error, isHttpError, isRedirect } from '@sveltejs/kit';
import { logger } from '$lib/server/logger.js';

export function handleAuthProviderLoadError(err: unknown): never {
	if (isHttpError(err) || isRedirect(err)) throw err;

	logger.error(err, 'Failed to get auth provider:');
	throw error(500, { message: 'Failed to load provider' });
}
