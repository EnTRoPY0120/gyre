import type { HandleClientError } from '@sveltejs/kit';
import { logger } from '$lib/utils/logger';

const ALLOWED_CODES = new Set(['INVALID_INPUT', 'NOT_AUTHORIZED', 'NOT_FOUND', 'UNKNOWN']);

export const handleError: HandleClientError = ({ error, event }) => {
	logger.error(error, `Client error at ${event.url.pathname}:`);

	const rawCode =
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		typeof (error as { code: unknown }).code === 'string'
			? (error as { code: string }).code
			: 'UNKNOWN';

	const status =
		typeof error === 'object' &&
		error !== null &&
		'status' in error &&
		typeof (error as { status: unknown }).status === 'number'
			? (error as { status: number }).status
			: undefined;

	return {
		message: 'An unexpected error occurred',
		code: ALLOWED_CODES.has(rawCode) ? rawCode : 'UNKNOWN',
		status
	};
};
