import type { Handle } from '@sveltejs/kit';
import { getSession } from '$lib/server/auth';
import { initializeGyre } from '$lib/server/initialize';

// Initialize Gyre on first request
let initialized = false;

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
	'/login',
	'/api/auth/login',
	'/api/auth/logout',
	'/api/health',
	'/api/flux/health',
	'/manifest.json',
	'/favicon.ico',
	'/logo.svg'
];

// Static asset patterns
const STATIC_PATTERNS = [
	/^\/_app\//,
	/^\/fonts\//,
	/^\/images\//,
	/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/
];

function isPublicRoute(path: string): boolean {
	// Check exact matches
	if (PUBLIC_ROUTES.some((route) => path === route || path.startsWith(route + '/'))) {
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
 * 1. Session authentication
 * 2. Cluster context via cookies
 * 3. RBAC checks (future enhancement)
 */
export const handle: Handle = async ({ event, resolve }) => {
	const { url, cookies } = event;
	const path = url.pathname;

	// Initialize Gyre on first request
	if (!initialized) {
		try {
			await initializeGyre();
			initialized = true;
		} catch (error) {
			console.error('Failed to initialize Gyre:', error);
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
		}
	}

	// If not authenticated and not a public route, redirect to login
	if (!event.locals.user && !isPublicRoute(path)) {
		// For API routes, return 401
		if (path.startsWith('/api/')) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// For page routes, redirect to login
		return new Response(null, {
			status: 302,
			headers: { Location: '/login' }
		});
	}

	// Handle cluster context from cookies (for multi-cluster support)
	const cluster = cookies.get('gyre_cluster');
	if (cluster) {
		event.locals.cluster = cluster;
	} else {
		// Default to 'in-cluster' context
		event.locals.cluster = 'in-cluster';
	}

	// Protect admin routes
	if (path.startsWith('/admin') && event.locals.user?.role !== 'admin') {
		// For API routes under /admin, return 403
		if (path.startsWith('/api/admin')) {
			return new Response(JSON.stringify({ error: 'Forbidden' }), {
				status: 403,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// For page routes, redirect to dashboard
		return new Response(null, {
			status: 302,
			headers: { Location: '/' }
		});
	}

	return resolve(event);
};

/**
 * HandleError - Global error handler
 */
export function handleError({ error, event }: { error: unknown; event: { url: URL } }) {
	console.error('Error in', event.url.pathname, ':', error);

	return {
		message: error instanceof Error ? error.message : 'An unexpected error occurred',
		code:
			error instanceof Error && 'code' in error
				? (error as Error & { code: string }).code
				: 'UNKNOWN'
	};
}
