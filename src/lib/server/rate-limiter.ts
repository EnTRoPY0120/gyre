import crypto from 'crypto';
import { logger } from './logger.js';
import { error } from '@sveltejs/kit';
import { getDbSync } from './db/index.js';
import { loginLockouts, rateLimits } from './db/schema.js';
import { eq, sql } from 'drizzle-orm';

export class RateLimiter {
	private cleanupInterval: NodeJS.Timeout;

	constructor() {
		// Clean up expired entries every 5 minutes
		this.cleanupInterval = setInterval(
			() => {
				try {
					this.cleanup();
				} catch (err) {
					logger.error(err, 'Rate limiter cleanup failed');
				}
			},
			5 * 60 * 1000
		);
		// Allow the process to exit even if the interval is still running
		this.cleanupInterval.unref?.();
	}

	/**
	 * cleanup removes entries whose sliding window has fully elapsed.
	 * Uses per-row expireAt (set to currentWindowStart + 2 * windowMs) rather than a
	 * fixed horizon so rows with any windowMs are cleaned up correctly.
	 */
	private cleanup(): void {
		const db = getDbSync();
		const now = new Date();
		db.delete(rateLimits)
			.where(sql`${rateLimits.expireAt} < ${now}`)
			.run();
	}

	/**
	 * stop clears the internal cleanup interval.
	 * Call this when disposing of a RateLimiter instance.
	 */
	stop(): void {
		clearInterval(this.cleanupInterval);
	}

	/**
	 * check implements the Sliding Window Counter algorithm.
	 * It approximates the request count in the sliding window using:
	 * count = current_window_count + previous_window_count * (1 - fraction_of_current_window_elapsed)
	 *
	 * State is persisted in the database so it survives restarts and is shared
	 * across multiple app instances. The read and write are wrapped in a transaction
	 * to serialize concurrent access.
	 *
	 * @param key Unique identifier (e.g., IP address)
	 * @param limit Max number of requests allowed
	 * @param windowMs Time window in milliseconds
	 */
	check(
		key: string,
		limit: number,
		windowMs: number
	): {
		limited: boolean;
		remaining: number;
		resetAt: number;
		retryAfter: number;
	} {
		const db = getDbSync();

		// 'immediate' acquires a write lock up-front so concurrent processes block
		// on entry rather than racing through the read phase before either writes.
		return db.transaction(
			(tx) => {
				// Compute timestamps inside the transaction so they reflect the time
				// after the write lock is acquired, not before waiting for it.
				const now = Date.now();
				const currentWindowStart = Math.floor(now / windowMs) * windowMs;
				// expireAt covers two full windows so previousWindowCount data remains valid
				// for the window immediately after the one we write.
				const expireAt = new Date(currentWindowStart + 2 * windowMs);

				const row = tx.select().from(rateLimits).where(eq(rateLimits.key, key)).get();

				let currentWindowCount = 0;
				let previousWindowCount = 0;

				if (row) {
					if (row.lastWindowStart === currentWindowStart) {
						// Same window — carry forward both counts
						currentWindowCount = row.currentWindowCount;
						previousWindowCount = row.previousWindowCount;
					} else if (row.lastWindowStart === currentWindowStart - windowMs) {
						// Advanced exactly one window — previous becomes the old current
						previousWindowCount = row.currentWindowCount;
					}
					// else: multiple windows have elapsed — history is irrelevant, keep both at 0
				}

				// Calculate the estimated count in the sliding window
				const elapsedInCurrentWindow = now - currentWindowStart;
				const weight = 1 - elapsedInCurrentWindow / windowMs;
				const estimatedCount = currentWindowCount + 1 + previousWindowCount * weight;

				if (estimatedCount > limit) {
					// Refresh expireAt even on 429 so the row isn't cleaned up while this IP
					// is still actively making (rate-limited) requests.
					if (row) {
						tx.update(rateLimits).set({ expireAt }).where(eq(rateLimits.key, key)).run();
					}
					const retryAfter = Math.ceil((currentWindowStart + windowMs - now) / 1000);
					return {
						limited: true,
						remaining: 0,
						resetAt: currentWindowStart + windowMs,
						retryAfter
					};
				}

				// Persist incremented count via upsert
				tx.insert(rateLimits)
					.values({
						key,
						currentWindowCount: currentWindowCount + 1,
						previousWindowCount,
						lastWindowStart: currentWindowStart,
						expireAt,
						updatedAt: new Date()
					})
					.onConflictDoUpdate({
						target: rateLimits.key,
						set: {
							currentWindowCount: currentWindowCount + 1,
							previousWindowCount,
							lastWindowStart: currentWindowStart,
							expireAt,
							updatedAt: new Date()
						}
					})
					.run();

				const remaining = Math.max(0, limit - Math.ceil(estimatedCount));

				return {
					limited: false,
					remaining,
					resetAt: currentWindowStart + windowMs,
					retryAfter: 0
				};
			},
			{ behavior: 'immediate' }
		);
	}
}

// Global instance
const limiter = new RateLimiter();

/**
 * tryCheckRateLimit is a helper to check rate limits without throwing.
 * Useful when you want to handle the error yourself (e.g. redirecting).
 */
export function tryCheckRateLimit(
	event: { setHeaders: (headers: Record<string, string>) => void },
	key: string,
	limit: number,
	windowMs: number
) {
	const result = limiter.check(key, limit, windowMs);

	// Set standard rate limit headers
	event.setHeaders({
		'X-RateLimit-Limit': limit.toString(),
		'X-RateLimit-Remaining': result.remaining.toString(),
		'X-RateLimit-Reset': Math.ceil(result.resetAt / 1000).toString()
	});

	if (result.limited) {
		event.setHeaders({
			'Retry-After': result.retryAfter.toString()
		});
	}

	return result;
}

/**
 * checkRateLimit is a helper to enforce rate limits in SvelteKit endpoints.
 * It throws a 429 error if the limit is exceeded.
 */
export function checkRateLimit(
	event: { setHeaders: (headers: Record<string, string>) => void },
	key: string,
	limit: number,
	windowMs: number
) {
	const result = limiter.check(key, limit, windowMs);

	// Set standard rate limit headers
	event.setHeaders({
		'X-RateLimit-Limit': limit.toString(),
		'X-RateLimit-Remaining': result.remaining.toString(),
		'X-RateLimit-Reset': Math.ceil(result.resetAt / 1000).toString()
	});

	if (result.limited) {
		event.setHeaders({
			'Retry-After': result.retryAfter.toString()
		});
		throw error(429, {
			message: `Too many requests. Please try again in ${result.retryAfter} seconds.`
		});
	}
}

export class AccountLockout {
	private cleanupInterval: NodeJS.Timeout | undefined;

	constructor() {
		// Clean up expired entries every 15 minutes
		this.cleanupInterval = setInterval(() => this.cleanup(), 15 * 60 * 1000);
		this.cleanupInterval.unref?.();
	}

	private cleanup() {
		const db = getDbSync();
		const now = new Date();
		const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

		// Remove entries that have no failed attempts AND the lockout has expired for more than 1 hour
		db.delete(loginLockouts)
			.where(
				sql`(${loginLockouts.failedAttempts} = 0 OR ${loginLockouts.lockedUntil} < ${oneHourAgo.getTime() / 1000}) AND ${loginLockouts.lockedUntil} < ${now.getTime() / 1000}`
			)
			.run();
	}

	stop(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = undefined;
		}
	}

	check(username: string): { locked: boolean; lockedUntil: number; retryAfter: number } {
		const db = getDbSync();
		const entry = db.select().from(loginLockouts).where(eq(loginLockouts.username, username)).get();

		if (!entry || !entry.lockedUntil) return { locked: false, lockedUntil: 0, retryAfter: 0 };

		const now = Date.now();
		const lockedUntilMs = entry.lockedUntil.getTime();

		if (lockedUntilMs > now) {
			return {
				locked: true,
				lockedUntil: lockedUntilMs,
				retryAfter: Math.ceil((lockedUntilMs - now) / 1000)
			};
		}

		return { locked: false, lockedUntil: 0, retryAfter: 0 };
	}

	recordFailure(username: string, maxAttempts: number = 5): void {
		const db = getDbSync();
		const now = new Date();

		// Atomically increment the failure counter
		db.insert(loginLockouts)
			.values({
				username,
				failedAttempts: 1,
				updatedAt: now
			})
			.onConflictDoUpdate({
				target: loginLockouts.username,
				set: {
					failedAttempts: sql`${loginLockouts.failedAttempts} + 1`,
					updatedAt: now
				}
			})
			.run();

		// Read the updated count and conditionally apply lockout inside a transaction
		// to prevent a race condition where two concurrent failures both read the count
		// before either writes the lockedUntil value.
		db.transaction((tx) => {
			const entry = tx
				.select()
				.from(loginLockouts)
				.where(eq(loginLockouts.username, username))
				.get();

			if (entry && entry.failedAttempts >= maxAttempts) {
				const overThreshold = entry.failedAttempts - maxAttempts;
				const backoffMinutes = Math.pow(2, overThreshold);
				const lockedMinutes = Math.min(backoffMinutes, 1440); // Cap at 24 hours
				const lockedUntil = new Date(now.getTime() + lockedMinutes * 60 * 1000);

				tx.update(loginLockouts)
					.set({ lockedUntil, updatedAt: now })
					.where(eq(loginLockouts.username, username))
					.run();

				const userHash = crypto.createHash('sha256').update(username).digest('hex').substring(0, 8);
				logger.warn(
					{ userId: userHash },
					`[Security] Account lockout triggered; locked for ${lockedMinutes} minutes; failed attempts: ${entry.failedAttempts}`
				);
			}
		});
	}

	recordSuccess(username: string): void {
		const db = getDbSync();
		db.update(loginLockouts)
			.set({
				failedAttempts: 0,
				lockedUntil: null,
				updatedAt: new Date()
			})
			.where(eq(loginLockouts.username, username))
			.run();
	}
}

export const accountLockout = new AccountLockout();

/**
 * SSEConnectionLimiter tracks the number of active concurrent SSE connections
 * per authenticated session and per authenticated user.  Unlike RateLimiter
 * (which counts requests per time window), this class counts live connections
 * that have not yet been released.
 *
 * Session-based limiting is preferred over IP-based limiting because IP
 * addresses can be shared across many users (NAT, VPN, corporate proxies).
 * Tracking by session gives an accurate, per-client view without penalising
 * unrelated users who happen to share an IP.
 */
export class SSEConnectionLimiter {
	private sessionConnections: Map<string, number> = new Map();
	private userConnections: Map<string, number> = new Map();

	/**
	 * Try to acquire a connection slot.
	 *
	 * Returns `{ allowed: true, release }` on success – callers MUST invoke
	 * `release()` when the connection closes to free the slot.
	 * Returns `{ allowed: false, reason }` when either per-session or per-user
	 * limit is already reached.
	 */
	acquire(
		sessionId: string,
		userId: string,
		maxPerSession: number,
		maxPerUser: number
	):
		| { allowed: true; release: () => void }
		| { allowed: false; limitType: 'session_limit' | 'user_limit'; reason: string } {
		const sessionCount = this.sessionConnections.get(sessionId) ?? 0;
		if (sessionCount >= maxPerSession) {
			return {
				allowed: false,
				limitType: 'session_limit',
				reason: `Too many SSE connections for this session (max ${maxPerSession})`
			};
		}

		const userCount = this.userConnections.get(userId) ?? 0;
		if (userCount >= maxPerUser) {
			return {
				allowed: false,
				limitType: 'user_limit',
				reason: `Too many SSE connections for this user (max ${maxPerUser})`
			};
		}

		this.sessionConnections.set(sessionId, sessionCount + 1);
		this.userConnections.set(userId, userCount + 1);

		let released = false;
		return {
			allowed: true,
			release: () => {
				if (released) return;
				released = true;
				try {
					const newSessionCount = (this.sessionConnections.get(sessionId) ?? 1) - 1;
					if (newSessionCount <= 0) this.sessionConnections.delete(sessionId);
					else this.sessionConnections.set(sessionId, newSessionCount);

					const newUserCount = (this.userConnections.get(userId) ?? 1) - 1;
					if (newUserCount <= 0) this.userConnections.delete(userId);
					else this.userConnections.set(userId, newUserCount);
				} catch (err) {
					const redact = (v: string) =>
						crypto.createHash('sha256').update(v).digest('hex').substring(0, 8);
					logger.error(
						{ err, sessionId: redact(sessionId), userId: redact(userId) },
						'[SSEConnectionLimiter] Error in release()'
					);
				}
			}
		};
	}

	/** Current connection counts for a given session / user pair (for diagnostics). */
	getConnectionCounts(sessionId: string, userId: string): { session: number; user: number } {
		return {
			session: this.sessionConnections.get(sessionId) ?? 0,
			user: this.userConnections.get(userId) ?? 0
		};
	}
}

export const sseConnectionLimiter = new SSEConnectionLimiter();
