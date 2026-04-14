import { logger, withRequestContext } from '$lib/server/logger.js';
import type { Handle } from '@sveltejs/kit';
import {
	enforceAdminRouteGate,
	enforceAuthenticationGate,
	resolveClusterContext
} from '$lib/server/request/access.js';
import { assignRequestContext, finalizeResponse } from '$lib/server/request/context.js';
import { enforceCsrfProtection } from '$lib/server/request/csrf.js';
import { normalizeHandleError, resolveRouteAndMapErrors } from '$lib/server/request/errors.js';
import { ensureGyreInitialized, isGyreInitialized } from '$lib/server/request/initialization.js';
import { enforceGlobalRateLimit } from '$lib/server/request/rate-limit.js';
import { enforceRequestSizeLimits } from '$lib/server/request/request-size.js';
import { hydrateSessionLocals } from '$lib/server/request/session.js';

export const handle: Handle = async ({ event, resolve }) => {
	const context = assignRequestContext(event);

	return withRequestContext(context.requestId, async () => {
		const requestSizeResponse = await enforceRequestSizeLimits(event);
		if (requestSizeResponse) {
			return finalizeResponse(event, requestSizeResponse, context);
		}

		const rateLimitResponse = enforceGlobalRateLimit(event, isGyreInitialized());
		if (rateLimitResponse) {
			return finalizeResponse(event, rateLimitResponse, context);
		}

		try {
			await ensureGyreInitialized();
		} catch (err) {
			logger.error(err, 'Failed to ensure Gyre is initialized during request handling');
			const serviceUnavailableResponse = event.url.pathname.startsWith('/api/')
				? new Response(
						JSON.stringify({
							error: 'Service Unavailable',
							message: 'Gyre is still initializing'
						}),
						{
							status: 503,
							headers: { 'Content-Type': 'application/json' }
						}
					)
				: new Response('Service Unavailable', { status: 503 });
			return finalizeResponse(event, serviceUnavailableResponse, context);
		}

		const response = await resolveRouteAndMapErrors(event, async () => {
			// Session cookies are managed in the session helper via BETTER_AUTH_SESSION_COOKIE_NAME.
			await hydrateSessionLocals(event);

			const csrfResponse = await enforceCsrfProtection(event);
			if (csrfResponse) {
				return csrfResponse;
			}

			const authGateResponse = enforceAuthenticationGate(event);
			if (authGateResponse) {
				return authGateResponse;
			}

			await resolveClusterContext(event);

			const adminGateResponse = enforceAdminRouteGate(event);
			if (adminGateResponse) {
				return adminGateResponse;
			}

			return resolve(event);
		});
		return finalizeResponse(event, response, context);
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
	return normalizeHandleError({ error, event });
}
