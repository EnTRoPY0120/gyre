import type { HandleClientError } from '@sveltejs/kit/hooks';
import { normalizeError } from '#lib/utils/error-normalization.js';
import { logger } from '#lib/utils/logger.js';

export const handleError: HandleClientError = ({ error, kind, event }) => {
	const { code, status } = normalizeError(error);
	if (kind === 'unknown') {
		logger.error(error, `Client error at ${event.url.pathname}:`);
		return { status, message: 'An unexpected error occurred', code };
	}

	const caughtError = error as { message?: unknown; status?: unknown };
	return {
		status: typeof caughtError.status === 'number' ? caughtError.status : 500,
		message: typeof caughtError.message === 'string' ? caughtError.message : 'Internal Error',
		code
	};
};
