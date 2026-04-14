import { withRequestContext } from '$lib/server/logger.js';
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
import {
	createPayloadTooLargeResponse,
	enforceRequestSizeLimits,
	isPayloadTooLargeError
} from '$lib/server/request/request-size.js';
import { hydrateSessionLocals } from '$lib/server/request/session.js';

export const handle: Handle = async ({ event, resolve }) => {
	const context = assignRequestContext(event);

	return withRequestContext(context.requestId, async () => {
		const requestSizeResponse = await enforceRequestSizeLimits(event);
		if (requestSizeResponse) {
			return finalizeResponse(event, requestSizeResponse, context);
		}

		try {
			await ensureGyreInitialized();
		} catch {
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

		const rateLimitResponse = enforceGlobalRateLimit(event, isGyreInitialized());
		if (rateLimitResponse) {
			return finalizeResponse(event, rateLimitResponse, context);
		}

		// Session cookies are managed in the session helper via BETTER_AUTH_SESSION_COOKIE_NAME.
		await hydrateSessionLocals(event);

		let csrfResponse: Response | null = null;
		try {
			csrfResponse = await enforceCsrfProtection(event);
		} catch (err) {
			if (isPayloadTooLargeError(err)) {
				return finalizeResponse(event, createPayloadTooLargeResponse(event, err), context);
			}
			throw err;
		}
		if (csrfResponse) {
			return finalizeResponse(event, csrfResponse, context);
		}

		const authGateResponse = enforceAuthenticationGate(event);
		if (authGateResponse) {
			return finalizeResponse(event, authGateResponse, context);
		}

		await resolveClusterContext(event);

		const adminGateResponse = enforceAdminRouteGate(event);
		if (adminGateResponse) {
			return finalizeResponse(event, adminGateResponse, context);
		}

		const response = await resolveRouteAndMapErrors(event, resolve);
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
