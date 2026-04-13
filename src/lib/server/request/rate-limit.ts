import { tryCheckRateLimit } from '$lib/server/rate-limiter.js';
import { STATIC_PATTERNS } from '$lib/isPublicRoute.js';
import type { RequestEvent } from '@sveltejs/kit';

export function enforceGlobalRateLimit(
	event: Pick<RequestEvent, 'getClientAddress' | 'url'>,
	initialized: boolean
): Response | null {
	const path = event.url.pathname;
	const isStaticAsset = STATIC_PATTERNS.some((pattern) => pattern.test(path));
	const isHealthEndpoint =
		path === '/api/health' ||
		path === '/api/v1/health' ||
		path === '/api/flux/health' ||
		path === '/api/v1/flux/health';

	if (!initialized || isStaticAsset || isHealthEndpoint) {
		return null;
	}

	const ip = event.getClientAddress();
	// Pass a no-op setHeaders so the global limiter doesn't set X-RateLimit-* on the event —
	// endpoint-specific limiters own those headers and SvelteKit throws if they're set twice.
	const globalLimit = tryCheckRateLimit({ setHeaders: () => {} }, `global:${ip}`, 300, 60 * 1000);

	if (!globalLimit.limited) {
		return null;
	}

	return new Response(
		JSON.stringify({
			error: 'Too Many Requests',
			message: 'Rate limit exceeded. Please try again later.'
		}),
		{
			status: 429,
			headers: {
				'Content-Type': 'application/json',
				'Retry-After': globalLimit.retryAfter.toString()
			}
		}
	);
}
