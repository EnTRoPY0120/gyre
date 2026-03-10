import { logger } from '$lib/server/logger.js';
import type { Handle } from '@sveltejs/kit';
import { getSession } from '$lib/server/auth';
import { initializeGyre } from '$lib/server/initialize';
import { httpRequestDurationMicroseconds } from '$lib/server/metrics';
import { getRequestSizeLimit, validateRequestSize, formatSize } from '$lib/server/request-limits';
import { generateCsrfToken, validateCsrfToken } from '$lib/server/csrf';
import { CSRF_COOKIE_OPTIONS } from '$lib/server/config';

// Initialize Gyre on first request
let initialized = false;

// Public routes that don't require authentication or CSRF protection.
// NOTE: /api/auth/login and other auth-related routes are split here to ensure
// that authenticated routes like /api/auth/change-password or logout ARE protected by CSRF.
const PUBLIC_ROUTES = [
	'/login',
	'/api/auth/login',
	'/api/auth/logout',
	'/api/health',
	'/api/flux/health',
	'/metrics',
	'/manifest.json',
	'/favicon.ico',
	'/logo.svg'
];

// OAuth callback and login initiation routes are dynamic but public
const PUBLIC_ROUTE_PREFIXES = ['/api/auth/oidc/', '/api/auth/github/', '/api/auth/google/'];

// Static asset patterns
const STATIC_PATTERNS = [
	/^\/_app\//,
	/^\/fonts\//,
	/^\/images\//,
	/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/
];

const STATE_CHANGING_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

function isPublicRoute(path: string): boolean {
	// Check exact matches
	if (PUBLIC_ROUTES.some((route) => path === route || path.startsWith(route + '/'))) {
		return true;
	}

	// Check for OAuth routes which are public
	if (PUBLIC_ROUTE_PREFIXES.some((prefix) => path.startsWith(prefix))) {
		return true;
	}

	// Check static patterns
	if (STATIC_PATTERNS.some((pattern) => pattern.test(path))) {
		return true;
	}

	return false;
}

/**
 * Handle function to manage:
 * 1. Request size validation (DoS protection)
 * 2. Session authentication
 * 3. Cluster context via cookies
 * 4. RBAC checks (future enhancement)
 */
export const handle: Handle = async ({ event, resolve }) => {
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
		return response;
	};

	// Validate request size to prevent DoS attacks
	const sizeLimit = getRequestSizeLimit(path, request.method);
	const contentLength = request.headers.get('content-length') ?? undefined;
	const sizeValidation = validateRequestSize(contentLength, sizeLimit);

	if (!sizeValidation.valid) {
		console.warn(
			`Request size exceeded limit for ${request.method} ${path}: ${sizeValidation.size} > ${sizeValidation.limit}`
		);

		// For API routes return a JSON 413.
		// For page/form routes redirect back to the same URL with an error param so
		// the user sees the form rather than a raw JSON response in the browser.
		// NOTE: Pages that receive this redirect must read ?_error=payload_too_large
		// from their load function and surface it to the user.
		if (path.startsWith('/api/')) {
			return recordResponse(
				new Response(
					JSON.stringify({
						error: 'Payload Too Large',
						message: `Request payload exceeds maximum size of ${formatSize(sizeValidation.limit)}`
					}),
					{ status: 413, headers: { 'Content-Type': 'application/json' } }
				)
			);
		}

		// Preserve existing query params (e.g. search/pagination state) in the redirect.
		const redirectParams = new URLSearchParams(url.search);
		redirectParams.set('_error', 'payload_too_large');
		return recordResponse(
			new Response(null, {
				status: 303,
				headers: { Location: `${path}?${redirectParams}` }
			})
		);
	}

	// Initialize Gyre on first request
	if (!initialized) {
		try {
			await initializeGyre();
			initialized = true;
		} catch (error) {
			logger.error('Failed to initialize Gyre:', error);
			// Continue anyway - let the request fail naturally if DB is truly broken
		}
	}

	// Initialize locals with defaults
	event.locals.user = null;
	event.locals.session = null;
	event.locals.cluster = undefined;

	// Check for session cookie
	const sessionId = cookies.get('gyre_session');
	if (sessionId) {
		const sessionData = await getSession(sessionId);
		if (sessionData) {
			event.locals.user = sessionData.user;
			event.locals.session = sessionData.session;

			// Set CSRF token cookie (non-httpOnly so JS can read it)
			const csrfToken = generateCsrfToken(sessionData.session.id);
			if (cookies.get('gyre_csrf') !== csrfToken) {
				cookies.set('gyre_csrf', csrfToken, CSRF_COOKIE_OPTIONS);
			}
		}
	}

	// Validate CSRF token for state-changing methods on authenticated, non-public routes
	if (
		event.locals.session &&
		STATE_CHANGING_METHODS.includes(request.method) &&
		!isPublicRoute(path)
	) {
		let csrfToken = request.headers.get('x-csrf-token') ?? '';

		// If header is missing, check form data for _csrf (common for SvelteKit form actions)
		if (!csrfToken) {
			const contentType = request.headers.get('content-type') || '';
			const contentLength = parseInt(request.headers.get('content-length') ?? '0', 10);

			// Only attempt to parse form data if it's a standard form post and within a reasonable size (10MB)
			// to avoid memory exhaustion from cloning large payloads (e.g. backup restores).
			if (
				(contentType.includes('application/x-www-form-urlencoded') ||
					contentType.includes('multipart/form-data')) &&
				contentLength < 10 * 1024 * 1024
			) {
				try {
					// NOTE: Cloning request doubles memory for the duration of parsing.
					const formData = await request.clone().formData();
					csrfToken = formData.get('_csrf')?.toString() ?? '';
				} catch (e) {
					console.warn('Failed to parse form data for CSRF validation:', e);
				}
			}
		}

		if (!validateCsrfToken(event.locals.session.id, csrfToken)) {
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
				new Response(JSON.stringify({ error: 'Unauthorized' }), {
					status: 401,
					headers: { 'Content-Type': 'application/json' }
				})
			);
		}

		// For page routes, redirect to login
		return recordResponse(
			new Response(null, {
				status: 302,
				headers: { Location: '/login' }
			})
		);
	}

	// Handle cluster context from cookies (for multi-cluster support)
	const cluster = cookies.get('gyre_cluster');
	if (cluster) {
		event.locals.cluster = cluster;
	} else {
		// Default to 'in-cluster' context
		event.locals.cluster = 'in-cluster';
	}

	// Protect admin API routes
	if (path.startsWith('/api/admin') && event.locals.user?.role !== 'admin') {
		return recordResponse(
			new Response(JSON.stringify({ error: 'Forbidden' }), {
				status: 403,
				headers: { 'Content-Type': 'application/json' }
			})
		);
	}

	const response = await resolve(event);
	return recordResponse(response);
};

/**
 * HandleError - Global error handler
 */
export function handleError({ error, event }: { error: unknown; event: { url: URL } }) {
	logger.error('Error in', event.url.pathname, ':', error);

	return {
		message: error instanceof Error ? error.message : 'An unexpected error occurred',
		code:
			error instanceof Error && 'code' in error
				? (error as Error & { code: string }).code
				: 'UNKNOWN'
	};
}
