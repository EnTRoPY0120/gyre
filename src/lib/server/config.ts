/**
 * Server-side configuration constants.
 */

export const IS_PROD = process.env.NODE_ENV === 'production';

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
	maxAge: 60 * 60 * 24 * 7 // 7 days (session TTL)
};

/**
 * CSRF cookie options (must be readable by JS).
 */
export const CSRF_COOKIE_OPTIONS = {
	...DEFAULT_COOKIE_OPTIONS,
	httpOnly: false,
	sameSite: 'strict' as const
};
