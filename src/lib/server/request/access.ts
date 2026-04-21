import { ADMIN_ROUTE_PREFIXES } from '$lib/server/config.js';
import { resolveClusterSelectionFromCookie } from '$lib/server/clusters/selection.js';
import { isPublicRoute } from '$lib/isPublicRoute.js';
import type { RequestEvent } from '@sveltejs/kit';

export function enforceAuthenticationGate(
	event: Pick<RequestEvent, 'locals' | 'url'>
): Response | null {
	const path = event.url.pathname;
	if (event.locals.user || isPublicRoute(path)) {
		return null;
	}

	if (path.startsWith('/api/')) {
		return new Response(
			JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
			{
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}

	let safeReturnTo = '/';
	try {
		const parsed = new URL(path + event.url.search, event.url.origin);
		if (parsed.origin === event.url.origin) {
			safeReturnTo = parsed.pathname + parsed.search;
		}
	} catch {
		// malformed value — fall back to '/'
	}

	return new Response(null, {
		status: 302,
		headers: { Location: `/login?returnTo=${encodeURIComponent(safeReturnTo)}` }
	});
}

export async function resolveClusterContext(
	event: Pick<RequestEvent, 'cookies' | 'locals'>
): Promise<void> {
	event.locals.cluster = await resolveClusterSelectionFromCookie(event.cookies);
}

export function enforceAdminRouteGate(
	event: Pick<RequestEvent, 'locals' | 'url'>
): Response | null {
	const path = event.url.pathname;
	const isAdminRoute = ADMIN_ROUTE_PREFIXES.some(
		(prefix) => path === prefix || path.startsWith(prefix + '/')
	);

	if (!isAdminRoute || event.locals.user?.role === 'admin') {
		return null;
	}

	return new Response(JSON.stringify({ error: 'Forbidden', message: 'Admin access required' }), {
		status: 403,
		headers: { 'Content-Type': 'application/json' }
	});
}
