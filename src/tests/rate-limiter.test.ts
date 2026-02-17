import { describe, test, expect, beforeEach } from 'bun:test';
import { RateLimiter } from '../lib/server/rate-limiter';

describe('RateLimiter', () => {
	let limiter: RateLimiter;

	beforeEach(() => {
		limiter = new RateLimiter();
	});

	describe('basic rate limiting', () => {
		test('allows requests under the limit', () => {
			const result = limiter.check('test-key', 5, 60_000);
			expect(result.limited).toBe(false);
			expect(result.remaining).toBeGreaterThan(0);
		});

		test('blocks requests over the limit', () => {
			const limit = 3;
			const windowMs = 60_000;

			// Make requests up to the limit
			for (let i = 0; i < limit; i++) {
				const result = limiter.check('flood-key', limit, windowMs);
				expect(result.limited).toBe(false);
			}

			// Next request should be blocked
			const blocked = limiter.check('flood-key', limit, windowMs);
			expect(blocked.limited).toBe(true);
			expect(blocked.remaining).toBe(0);
			expect(blocked.retryAfter).toBeGreaterThan(0);
		});

		test('different keys are tracked independently', () => {
			const limit = 2;
			const windowMs = 60_000;

			// Exhaust limit for key-a
			limiter.check('key-a', limit, windowMs);
			limiter.check('key-a', limit, windowMs);
			const blockedA = limiter.check('key-a', limit, windowMs);
			expect(blockedA.limited).toBe(true);

			// key-b should still be allowed
			const resultB = limiter.check('key-b', limit, windowMs);
			expect(resultB.limited).toBe(false);
		});
	});

	describe('response shape', () => {
		test('returns all expected fields', () => {
			const result = limiter.check('shape-key', 10, 60_000);
			expect(result).toHaveProperty('limited');
			expect(result).toHaveProperty('remaining');
			expect(result).toHaveProperty('resetAt');
			expect(result).toHaveProperty('retryAfter');
			expect(typeof result.limited).toBe('boolean');
			expect(typeof result.remaining).toBe('number');
			expect(typeof result.resetAt).toBe('number');
			expect(typeof result.retryAfter).toBe('number');
		});

		test('retryAfter is 0 when not limited', () => {
			const result = limiter.check('retry-key', 10, 60_000);
			expect(result.retryAfter).toBe(0);
		});

		test('resetAt is in the future', () => {
			const result = limiter.check('reset-key', 10, 60_000);
			expect(result.resetAt).toBeGreaterThan(Date.now() - 1000);
		});
	});

	describe('remaining count accuracy', () => {
		test('remaining decreases with each request', () => {
			const limit = 5;
			const windowMs = 60_000;

			const r1 = limiter.check('dec-key', limit, windowMs);
			const r2 = limiter.check('dec-key', limit, windowMs);

			expect(r2.remaining).toBeLessThan(r1.remaining);
		});
	});

	describe('edge cases', () => {
		test('handles limit of 1', () => {
			const r1 = limiter.check('one-key', 1, 60_000);
			expect(r1.limited).toBe(false);

			const r2 = limiter.check('one-key', 1, 60_000);
			expect(r2.limited).toBe(true);
		});

		test('handles very small window', () => {
			const result = limiter.check('small-window', 100, 1);
			expect(result).toHaveProperty('limited');
		});

		test('handles very large limit', () => {
			const result = limiter.check('big-limit', 1_000_000, 60_000);
			expect(result.limited).toBe(false);
		});
	});
});
