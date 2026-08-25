import { logger } from '$lib/utils/logger.js';

function readCsrfTokenFromDocument(): string {
	const match = document.cookie.match(/(?:^|;\s*)gyre_csrf=([^;]+)/);
	return match ? decodeURIComponent(match[1]) : '';
}

function warnIfCsrfTokenMissing(token: string): void {
	if (!token && import.meta.env?.DEV) {
		logger.warn(
			'CSRF token (gyre_csrf cookie) is missing. State-changing requests will fail with 403 Forbidden.'
		);
	}
}

export function getCsrfToken(): string {
	if (typeof document === 'undefined') return '';
	const token = readCsrfTokenFromDocument();
	warnIfCsrfTokenMissing(token);

	return token;
}
