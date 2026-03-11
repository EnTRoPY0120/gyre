import { createHmac, timingSafeEqual } from 'node:crypto';

let _cachedSecret: string | null = null;

const getSecret = (): string => {
	if (_cachedSecret) return _cachedSecret;

	const secret = process.env.AUTH_ENCRYPTION_KEY;
	const isProd = process.env.NODE_ENV === 'production';

	if (!secret) {
		if (isProd) {
			throw new Error(
				'AUTH_ENCRYPTION_KEY must be set in production! ' +
					'Please set it to a 64-character hexadecimal string.'
			);
		}
		console.warn(
			'⚠️  AUTH_ENCRYPTION_KEY not set! Using development-only CSRF secret. DO NOT USE IN PRODUCTION!'
		);
		return (_cachedSecret = 'insecure-dev-fallback-do-not-use-in-production-0123456789abcdef');
	}

	// Validate key format (should be 64 hex characters = 32 bytes)
	if (!/^[0-9a-f]{64}$/i.test(secret)) {
		throw new Error(
			'AUTH_ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes). Generate with: openssl rand -hex 32'
		);
	}

	return (_cachedSecret = secret);
};

/**
 * Generate a stateless HMAC-SHA256 CSRF token derived from the session ID.
 * Note: Tokens are valid for the entire session lifetime (no rotation).
 * This is a stateless double-submit pattern trade-off for performance and simplicity.
 */
export function generateCsrfToken(sessionId: string): string {
	return createHmac('sha256', getSecret()).update(sessionId).digest('hex');
}

export function validateCsrfToken(sessionId: string, token: string): boolean {
	if (!token) return false;
	const expected = generateCsrfToken(sessionId);

	// Fast-path for length mismatch to avoid unnecessary Buffer operations
	if (token.length !== expected.length) return false;

	try {
		return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(token, 'hex'));
	} catch {
		return false;
	}
}
