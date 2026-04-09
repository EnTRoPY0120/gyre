import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';

spyOn(console, 'log').mockImplementation(() => {});
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '../lib/server/db/schema.js';

const state: {
	db: ReturnType<typeof drizzle<typeof schema>> | null;
	sqlite: Database | null;
} = {
	db: null,
	sqlite: null
};

mock.module('../lib/server/db/index.js', () => ({
	getDb: async () => state.db,
	getDbSync: () => state.db,
	schema
}));

import { RateLimiter, SSEConnectionLimiter } from '../lib/server/rate-limiter';
mock.restore();

const CREATE_RATE_LIMITS_TABLE = `
	CREATE TABLE IF NOT EXISTS rate_limits (
		key TEXT PRIMARY KEY,
		current_window_count INTEGER NOT NULL DEFAULT 0,
		previous_window_count INTEGER NOT NULL DEFAULT 0,
		last_window_start INTEGER NOT NULL DEFAULT 0,
		expire_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	)
`;

function setupInMemoryDb() {
	const sqlite = new Database(':memory:');
	sqlite.exec(CREATE_RATE_LIMITS_TABLE);
	state.sqlite = sqlite;
	return drizzle(sqlite, { schema });
}

describe('RateLimiter', () => {
	let limiter: RateLimiter;

	beforeEach(() => {
		state.db = setupInMemoryDb();
		// Each test gets a fresh instance with empty storage; prevents state leaking
		// across tests (since RateLimiter storage is instance-level, not module-level).
		limiter = new RateLimiter();
	});

	afterEach(() => {
		// Explicitly stop the interval to avoid lingering timers.
		// The stop() method clears the internal setInterval created in the constructor.
		limiter.stop();
		state.sqlite?.close();
		state.sqlite = null;
		state.db = null;
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

		test('fresh instance shares persisted state through the backing database', () => {
			// Exhaust a key in one instance
			const old = new RateLimiter();

			// A new instance reads the same persisted counters.
			const fresh = new RateLimiter();
			try {
				old.check('shared-key', 1, 60_000);
				old.check('shared-key', 1, 60_000); // now blocked in old

				const result = fresh.check('shared-key', 1, 60_000);
				expect(result.limited).toBe(true);
			} finally {
				old.stop();
				fresh.stop();
			}
		});

		test('multiple requests from the same key within one window accumulate correctly', () => {
			const limit = 5;
			const windowMs = 60_000;
			const results: boolean[] = [];

			for (let i = 0; i < limit + 2; i++) {
				results.push(limiter.check('same-key', limit, windowMs).limited);
			}

			// First `limit` requests should be allowed, the rest blocked
			const allowed = results.filter((r) => !r).length;
			const blocked = results.filter((r) => r).length;
			expect(allowed).toBe(limit);
			expect(blocked).toBe(2);
		});
	});
});

describe('SSEConnectionLimiter', () => {
	let limiter: SSEConnectionLimiter;

	beforeEach(() => {
		limiter = new SSEConnectionLimiter();
	});

	describe('acquire', () => {
		test('allows a connection under both limits', () => {
			const result = limiter.acquire('session-1', 'user-1', 3, 5);
			expect(result.allowed).toBe(true);
		});

		test('blocks when session limit is reached', () => {
			limiter.acquire('session-1', 'user-1', 2, 10);
			limiter.acquire('session-1', 'user-2', 2, 10);

			const blocked = limiter.acquire('session-1', 'user-3', 2, 10);
			expect(blocked.allowed).toBe(false);
			if (!blocked.allowed) {
				expect(blocked.limitType).toBe('session_limit');
			}
		});

		test('blocks when user limit is reached', () => {
			limiter.acquire('session-1', 'user-1', 10, 2);
			limiter.acquire('session-2', 'user-1', 10, 2);

			const blocked = limiter.acquire('session-3', 'user-1', 10, 2);
			expect(blocked.allowed).toBe(false);
			if (!blocked.allowed) {
				expect(blocked.limitType).toBe('user_limit');
			}
		});

		test('session limit is checked before user limit', () => {
			limiter.acquire('session-1', 'user-1', 1, 1);

			const blocked = limiter.acquire('session-1', 'user-1', 1, 1);
			expect(blocked.allowed).toBe(false);
			if (!blocked.allowed) {
				expect(blocked.limitType).toBe('session_limit');
			}
		});

		test('different sessions for the same user are tracked independently', () => {
			const r1 = limiter.acquire('session-1', 'user-1', 3, 5);
			const r2 = limiter.acquire('session-2', 'user-1', 3, 5);
			expect(r1.allowed).toBe(true);
			expect(r2.allowed).toBe(true);
		});

		test('different users for the same session are tracked independently', () => {
			const r1 = limiter.acquire('session-1', 'user-1', 5, 3);
			const r2 = limiter.acquire('session-1', 'user-2', 5, 3);
			expect(r1.allowed).toBe(true);
			expect(r2.allowed).toBe(true);
		});
	});

	describe('release', () => {
		test('frees the slot so a new connection is allowed', () => {
			const result = limiter.acquire('session-1', 'user-1', 1, 1);
			expect(result.allowed).toBe(true);
			if (!result.allowed) return;

			const blocked = limiter.acquire('session-1', 'user-1', 1, 1);
			expect(blocked.allowed).toBe(false);

			result.release();

			const allowed = limiter.acquire('session-1', 'user-1', 1, 1);
			expect(allowed.allowed).toBe(true);
		});

		test('release is idempotent – calling it twice does not double-decrement', () => {
			const r1 = limiter.acquire('session-1', 'user-1', 2, 2);
			const r2 = limiter.acquire('session-1', 'user-1', 2, 2);
			expect(r1.allowed).toBe(true);
			expect(r2.allowed).toBe(true);

			if (!r1.allowed || !r2.allowed) return;

			r1.release();
			r1.release(); // second call must be a no-op

			// Only one slot was freed; r2 still holds the other
			const counts = limiter.getConnectionCounts('session-1', 'user-1');
			expect(counts.session).toBe(1);
			expect(counts.user).toBe(1);
		});

		test('release decrements both session and user counters', () => {
			const result = limiter.acquire('session-1', 'user-1', 5, 5);
			expect(result.allowed).toBe(true);
			if (!result.allowed) return;

			let counts = limiter.getConnectionCounts('session-1', 'user-1');
			expect(counts.session).toBe(1);
			expect(counts.user).toBe(1);

			result.release();

			counts = limiter.getConnectionCounts('session-1', 'user-1');
			expect(counts.session).toBe(0);
			expect(counts.user).toBe(0);
		});
	});

	describe('getConnectionCounts', () => {
		test('returns zero for unknown session and user', () => {
			const counts = limiter.getConnectionCounts('unknown-session', 'unknown-user');
			expect(counts.session).toBe(0);
			expect(counts.user).toBe(0);
		});

		test('reflects current active connections', () => {
			limiter.acquire('session-1', 'user-1', 5, 5);
			limiter.acquire('session-1', 'user-1', 5, 5);

			const counts = limiter.getConnectionCounts('session-1', 'user-1');
			expect(counts.session).toBe(2);
			expect(counts.user).toBe(2);
		});
	});
});
