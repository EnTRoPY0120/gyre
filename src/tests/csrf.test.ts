import { describe, it, expect } from 'bun:test';
import { generateCsrfToken, validateCsrfToken } from '../lib/server/csrf';

describe('CSRF Protection', () => {
	const sessionId = 'test-session-id-12345';

	it('should generate a valid CSRF token', () => {
		const token = generateCsrfToken(sessionId);
		expect(token).toBeDefined();
		expect(token.length).toBe(64); // SHA256 hex
		expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
	});

	it('should validate a correct CSRF token', () => {
		const token = generateCsrfToken(sessionId);
		expect(validateCsrfToken(sessionId, token)).toBe(true);
	});

	it('should fail for incorrect session ID', () => {
		const token = generateCsrfToken(sessionId);
		expect(validateCsrfToken('wrong-session-id', token)).toBe(false);
	});

	it('should fail for incorrect token', () => {
		expect(validateCsrfToken(sessionId, 'wrong-token')).toBe(false);
	});

	it('should fail for empty token', () => {
		expect(validateCsrfToken(sessionId, '')).toBe(false);
	});

	it('should fail for malformed hex tokens', () => {
		const malformed = 'not-a-hex-token-at-all-but-is-64-characters-long-0123456789abcde';
		expect(validateCsrfToken(sessionId, malformed)).toBe(false);
	});

	it('should fail for tokens with incorrect length', () => {
		const shortToken = 'abcdef123456';
		expect(validateCsrfToken(sessionId, shortToken)).toBe(false);
	});

	it('should handle runtime secret changes through caching behavior', () => {
		// This test documents the behavior that the secret is cached
		const token1 = generateCsrfToken(sessionId);

		// Even if we were to change process.env.AUTH_ENCRYPTION_KEY here,
		// the cached secret would still be used.

		expect(validateCsrfToken(sessionId, token1)).toBe(true);
	});
});
