import type { HandleClientError } from '@sveltejs/kit';
import { logger } from '$lib/utils/logger';
import { normalizeError } from '$lib/utils/error-normalization';

export const handleError: HandleClientError = ({ error, event }) => {
	logger.error(error, `Client error at ${event.url.pathname}:`);
	const { code, status } = normalizeError(error);
	return { message: 'An unexpected error occurred', code, status };
};
