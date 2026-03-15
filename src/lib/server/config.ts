/**
 * Server-side configuration constants.
 */

export const IS_PROD = process.env.NODE_ENV === 'production';

import { SESSION_DURATION_DAYS } from './auth.js';

/**
 * Default cookie options for security.
 * NOTE: secure: IS_PROD allows cookies to work over HTTP in local development.
 * In production, secure is always true to ensure cookies are only sent over HTTPS.
 */
export const DEFAULT_COOKIE_OPTIONS = {
	path: '/',
	httpOnly: true,
	secure: IS_PROD,
	sameSite: 'lax' as const,
	maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60
};

/**
 * CSRF cookie options (must be readable by JS).
 */
export const CSRF_COOKIE_OPTIONS = {
	...DEFAULT_COOKIE_OPTIONS,
	httpOnly: false,
	sameSite: 'strict' as const
};
