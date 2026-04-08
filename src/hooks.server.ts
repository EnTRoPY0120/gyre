import { logger, withRequestContext } from '$lib/server/logger.js';
import { isRedirect, isHttpError, type Handle } from '@sveltejs/kit';
import {
	BETTER_AUTH_SESSION_COOKIE_NAME,
	getBetterAuthSession
} from '$lib/server/auth/better-auth';
import { initializeGyre } from '$lib/server/initialize';
import { httpRequestDurationMicroseconds } from '$lib/server/metrics';
import { getRequestSizeLimit, validateRequestSize, formatSize } from '$lib/server/request-limits';
import { generateCsrfToken, validateCsrfToken } from '$lib/server/csrf';
import { CSRF_COOKIE_OPTIONS, IS_PROD, ADMIN_ROUTE_PREFIXES } from '$lib/server/config';
import { tryCheckRateLimit } from '$lib/server/rate-limiter';
import { getClusterById } from '$lib/server/clusters';
import { errorToHttpResponse } from '$lib/server/kubernetes/errors';
import { normalizeError } from '$lib/utils/error-normalization';
import { isPublicRoute, STATIC_PATTERNS } from '$lib/isPublicRoute.js';

// Initialize Gyre on first request
let initialized = false;
let initializingPromise: Promise<void> | undefined;

const STATE_CHANGING_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

function setSecurityHeaders(response: Response): void {
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	// Content-Security-Policy is managed by SvelteKit via kit.csp in svelte.config.js,
	// which injects per-request nonces into inline hydration scripts. Setting it here
	// would overwrite those nonces and break page hydration.
	if (IS_PROD) {
		response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}
}

/**
 * Handle function to manage:
 * 1. Request size validation (DoS protection)
 * 2. Session authentication
 * 3. Cluster context via cookies
 * 4. RBAC checks (future enhancement)
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const handle: Handle = async ({ event, resolve }) => {
	const requestIdRaw = event.request.headers.get('x-request-id');
	const requestId =
		requestIdRaw && UUID_REGEX.test(requestIdRaw) ? requestIdRaw : crypto.randomUUID();
	event.locals.requestId = requestId;

	return withRequestContext(requestId, async () => {
		const start = Date.now();
		const { url, cookies, request } = event;
		const path = url.pathname;

		const recordResponse = (response: Response) => {
			if (!path.startsWith('/metrics')) {
				const duration = (Date.now() - start) / 1000;
				const routeTemplate = event.route?.id || path;
				httpRequestDurationMicroseconds
					.labels(event.request.method, routeTemplate, response.status.toString())
					.observe(duration);
			}
			response.headers.set('x-request-id', requestId);
			setSecurityHeaders(response);
			return response;
		};

		function isPayloadTooLargeError(
			err: unknown
		): err is { isPayloadTooLarge: true; size: number; limit: number } {
			if (typeof err !== 'object' || err === null) return false;
			const e = err as Record<string, unknown>;
			return (
				e.isPayloadTooLarge === true && typeof e.size === 'number' && typeof e.limit === 'number'
			);
		}

		function payloadTooLargeResponse(
			err: { size: number; limit: number },
			req: Request,
			reqPath: string
		): Response {
			logger.warn(
				{ method: req.method, path: reqPath, size: err.size, limit: err.limit },
				'Request size exceeded limit'
			);
			if (reqPath.startsWith('/api/')) {
				return recordResponse(
					new Response(
						JSON.stringify({
							error: 'Payload Too Large',
							message: `Request payload exceeds maximum size of ${formatSize(err.limit)}`
						}),
						{ status: 413, headers: { 'Content-Type': 'application/json' } }
					)
				);
			}
			const redirectParams = new URLSearchParams(url.search);
			redirectParams.set('_error', 'payload_too_large');
			return recordResponse(
				new Response(null, {
					status: 303,
					headers: { Location: `${reqPath}?${redirectParams}` }
				})
			);
		}

		// Validate request size to prevent DoS attacks
		const sizeLimit = getRequestSizeLimit(path, request.method);
		const contentLength = request.headers.get('content-length') ?? undefined;
		const sizeValidation = validateRequestSize(contentLength, sizeLimit, request.method);

		if (!sizeValidation.valid) {
			// For API routes return a JSON 413; for page/form routes redirect back with
			// an error param so the user sees the form rather than a raw JSON response.
			// NOTE: Pages that receive this redirect must read ?_error=payload_too_large
			// from their load function and surface it to the user.
			return payloadTooLargeResponse(
				{ size: sizeValidation.size, limit: sizeValidation.limit },
				request,
				path
			);
		}

		// Streaming size guard: catches chunked/transfer-encoded requests that omit
		// Content-Length. The full body is piped through the transform before the
		// handler runs so size violations are rejected immediately. Using
		// ByteLengthQueuingStrategy lets the readable buffer up to sizeLimit bytes
		// so pipeTo can resolve without a concurrent reader; event.request is only
		// constructed after the guard resolves successfully.
		// Skip pre-read when Content-Length is present — the header-based check
		// above already enforces the limit without consuming the stream.
		if (
			request.body &&
			STATE_CHANGING_METHODS.includes(request.method) &&
			!request.headers.has('content-length')
		) {
			let bytesRead = 0;
			const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>(
				{
					transform(chunk, controller) {
						bytesRead += chunk.byteLength;
						if (bytesRead > sizeLimit) {
							controller.error(
								Object.assign(new Error('Payload Too Large'), {
									isPayloadTooLarge: true,
									limit: sizeLimit,
									size: bytesRead
								})
							);
							return;
						}
						controller.enqueue(chunk);
					}
				},
				undefined,
				new ByteLengthQueuingStrategy({ highWaterMark: sizeLimit })
			);
			try {
				await request.body.pipeTo(writable);
			} catch (err) {
				if (isPayloadTooLargeError(err)) return payloadTooLargeResponse(err, request, path);
				// Any other pipe failure (client disconnect, stream abort, upstream error)
				// leaves `readable` in an errored state. Do not hand a broken stream to
				// downstream handlers — return a stream-failure response instead.
				return recordResponse(new Response('Stream error', { status: 499 }));
			}
			event.request = new Request(request, {
				body: readable,
				duplex: 'half'
			} as RequestInit);
		}

		// Initialize Gyre on first request — promise lock prevents concurrent init calls
		if (!initialized) {
			if (!initializingPromise) {
				initializingPromise = initializeGyre()
					.then(() => {
						initialized = true;
					})
					.catch((error) => {
						logger.error(error, 'Failed to initialize Gyre:');
						// Continue anyway - let the request fail naturally if DB is truly broken
					})
					.finally(() => {
						initializingPromise = undefined;
					});
			}
			await initializingPromise;
		}

		// Global rate limiting: 300 req/min per IP (skip static assets and health checks)
		// Run this only after initialization so the backing table exists on a fresh database.
		const isStaticAsset = STATIC_PATTERNS.some((p) => p.test(path));
		const isHealthEndpoint =
			path === '/api/health' ||
			path === '/api/v1/health' ||
			path === '/api/flux/health' ||
			path === '/api/v1/flux/health';
		if (initialized && !isStaticAsset && !isHealthEndpoint) {
			const ip = event.getClientAddress();
			// Pass a no-op setHeaders so the global limiter doesn't set X-RateLimit-* on the event —
			// endpoint-specific limiters own those headers and SvelteKit throws if they're set twice.
			const globalLimit = tryCheckRateLimit(
				{ setHeaders: () => {} },
				`global:${ip}`,
				300,
				60 * 1000
			);
			if (globalLimit.limited) {
				return recordResponse(
					new Response(
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
					)
				);
			}
		}

		// Initialize locals with defaults
		event.locals.user = null;
		event.locals.session = null;
		event.locals.cluster = undefined;

		// Check for session cookie
		if (cookies.get(BETTER_AUTH_SESSION_COOKIE_NAME)) {
			const sessionData = await getBetterAuthSession(request, cookies);
			if (sessionData) {
				event.locals.user = sessionData.user;
				event.locals.session = sessionData.session;

				// Set CSRF token cookie (non-httpOnly so JS can read it)
				const csrfToken = generateCsrfToken(sessionData.session.id);
				if (cookies.get('gyre_csrf') !== csrfToken) {
					cookies.set('gyre_csrf', csrfToken, CSRF_COOKIE_OPTIONS);
				}
			} else {
				// Session is expired, invalid, or the user has been deactivated
				// (getSession already revoked all DB sessions in the inactive-user case).
				// Clear the stale cookie so the client doesn't keep replaying it.
				cookies.delete(BETTER_AUTH_SESSION_COOKIE_NAME, { path: '/' });
			}
		}

		// Validate CSRF token for state-changing methods on authenticated, non-public routes
		if (
			event.locals.session &&
			STATE_CHANGING_METHODS.includes(request.method) &&
			!isPublicRoute(path)
		) {
			// Header first; fall back to form body for use:enhance forms that still
			// submit _csrf as a hidden field until they are migrated to the header.
			// Only call formData() when the header is absent and the content-type is
			// form-compatible to avoid parsing non-form bodies or masking size errors.
			// Clone event.request (not the original `request` whose body is already
			// piped into the size-guard transform).
			const headerToken = request.headers.get('x-csrf-token');
			let csrfToken: string;
			if (headerToken !== null) {
				csrfToken = headerToken;
			} else {
				const contentType = request.headers.get('content-type') ?? '';
				const isFormCompatible =
					contentType.startsWith('multipart/form-data') ||
					contentType.startsWith('application/x-www-form-urlencoded');
				if (isFormCompatible) {
					try {
						const fd = await event.request.clone().formData();
						const rawToken = fd.get('_csrf');
						csrfToken = typeof rawToken === 'string' ? rawToken : '';
					} catch (err) {
						if (isPayloadTooLargeError(err)) throw err;
						csrfToken = '';
					}
				} else {
					csrfToken = '';
				}
			}

			if (!validateCsrfToken(event.locals.session.id, csrfToken)) {
				logger.warn('CSRF token validation failed', {
					userId: event.locals.user?.id,
					method: request.method,
					path
				});
				return recordResponse(
					new Response(
						JSON.stringify({ error: 'Forbidden', message: 'Invalid or missing CSRF token' }),
						{ status: 403, headers: { 'Content-Type': 'application/json' } }
					)
				);
			}
		}

		// If not authenticated and not a public route, redirect to login
		if (!event.locals.user && !isPublicRoute(path)) {
			// For API routes, return 401
			if (path.startsWith('/api/')) {
				return recordResponse(
					new Response(
						JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
						{
							status: 401,
							headers: { 'Content-Type': 'application/json' }
						}
					)
				);
			}

			// For page routes, redirect to login preserving return destination.
			// Validate via URL parse so backslash-normalization and scheme-relative bypasses are caught
			// by the parser before our origin check runs.
			let safeReturnTo = '/';
			try {
				const parsed = new URL(path + url.search, url.origin);
				if (parsed.origin === url.origin) {
					safeReturnTo = parsed.pathname + parsed.search;
				}
			} catch {
				// malformed value — fall back to '/'
			}
			return recordResponse(
				new Response(null, {
					status: 302,
					headers: { Location: `/login?returnTo=${encodeURIComponent(safeReturnTo)}` }
				})
			);
		}

		// Handle cluster context from cookies (for multi-cluster support)
		const cluster = cookies.get('gyre_cluster');
		if (cluster) {
			// Validate the cluster exists in the database (skip for built-in in-cluster context)
			if (cluster !== 'in-cluster') {
				// Let DB errors propagate — don't silently fall back on infrastructure failures
				const clusterRecord = await getClusterById(cluster);
				if (!clusterRecord || !clusterRecord.isActive) {
					// Unknown or inactive cluster — clear the stale cookie and fall back to in-cluster
					cookies.delete('gyre_cluster', { path: '/' });
					event.locals.cluster = 'in-cluster';
				} else {
					event.locals.cluster = cluster;
				}
			} else {
				event.locals.cluster = cluster;
			}
		} else {
			// Default to 'in-cluster' context
			event.locals.cluster = 'in-cluster';
		}

		// Protect admin API routes
		if (
			ADMIN_ROUTE_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + '/')) &&
			event.locals.user?.role !== 'admin'
		) {
			return recordResponse(
				new Response(JSON.stringify({ error: 'Forbidden', message: 'Admin access required' }), {
					status: 403,
					headers: { 'Content-Type': 'application/json' }
				})
			);
		}

		if (path.startsWith('/api/')) {
			try {
				const response = await resolve(event);
				return recordResponse(response);
			} catch (err) {
				if (isPayloadTooLargeError(err)) return payloadTooLargeResponse(err, request, path);
				if (isRedirect(err) || isHttpError(err)) throw err;
				logger.error(err, `Unhandled error in API route ${path}:`);
				const { status, body } = errorToHttpResponse(err);
				return recordResponse(
					new Response(JSON.stringify(body), {
						status,
						headers: { 'Content-Type': 'application/json' }
					})
				);
			}
		}

		try {
			const response = await resolve(event);
			return recordResponse(response);
		} catch (err) {
			if (isPayloadTooLargeError(err)) return payloadTooLargeResponse(err, request, path);
			throw err;
		}
	});
};

/**
 * HandleError - Global error handler
 */
export function handleError({
	error,
	event
}: {
	error: unknown;
	event: { url: URL; locals?: App.Locals };
}) {
	const requestId = event.locals?.requestId;
	if (requestId) {
		logger.error(error, `Error in ${event.url.pathname}:`, { requestId });
	} else {
		logger.error(error, `Error in ${event.url.pathname}:`);
	}

	const { code, status } = normalizeError(error);
	return { message: 'An unexpected error occurred', code, status };
}
