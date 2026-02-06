import { error } from '@sveltejs/kit';

interface RateLimitEntry {
	currentWindowCount: number;
	previousWindowCount: number;
	lastWindowStart: number;
}

export class RateLimiter {
	private storage: Map<string, RateLimitEntry> = new Map();
	private cleanupInterval: NodeJS.Timeout;

	constructor() {
		// Clean up expired entries every 5 minutes
		this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
		// Allow the process to exit even if the interval is still running
		this.cleanupInterval.unref?.();
	}

	/**
	 * cleanup removes expired entries from the storage
	 */
	private cleanup() {
		const now = Date.now();
		// In a real sliding window, "expired" depends on the windowMs of the check.
		// For simplicity in cleanup, we'll keep entries for at least 1 hour
		const oneHourAgo = now - 60 * 60 * 1000;
		for (const [key, entry] of this.storage.entries()) {
			if (entry.lastWindowStart < oneHourAgo) {
				this.storage.delete(key);
			}
		}
	}

	/**
	 * check implements the Sliding Window Counter algorithm.
	 * It approximates the request count in the sliding window using:
	 * count = current_window_count + previous_window_count * (1 - fraction_of_current_window_elapsed)
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
		const now = Date.now();
		const currentWindowStart = Math.floor(now / windowMs) * windowMs;

		let entry = this.storage.get(key);

		if (!entry) {
			entry = {
				currentWindowCount: 0,
				previousWindowCount: 0,
				lastWindowStart: currentWindowStart
			};
		} else if (entry.lastWindowStart !== currentWindowStart) {
			// If we've moved to a new window
			if (entry.lastWindowStart === currentWindowStart - windowMs) {
				// We moved to the immediately following window
				entry.previousWindowCount = entry.currentWindowCount;
			} else {
				// We moved several windows ahead
				entry.previousWindowCount = 0;
			}
			entry.currentWindowCount = 0;
			entry.lastWindowStart = currentWindowStart;
		}

		// Calculate the estimated count in the sliding window
		const elapsedInCurrentWindow = now - currentWindowStart;
		const weight = 1 - elapsedInCurrentWindow / windowMs;
		const estimatedCount = entry.currentWindowCount + 1 + entry.previousWindowCount * weight;

		if (estimatedCount > limit) {
			const retryAfter = Math.ceil((currentWindowStart + windowMs - now) / 1000);
			return {
				limited: true,
				remaining: 0,
				resetAt: currentWindowStart + windowMs,
				retryAfter
			};
		}

		// Increment count for current window
		entry.currentWindowCount++;
		this.storage.set(key, entry);

		const remaining = Math.max(0, limit - Math.floor(estimatedCount));

		return {
			limited: false,
			remaining,
			resetAt: currentWindowStart + windowMs,
			retryAfter: 0
		};
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
	event: { request: Request; setHeaders: (headers: Record<string, string>) => void },
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
