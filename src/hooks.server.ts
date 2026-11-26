import { logger, withRequestContext } from '#lib/server/logger.js';
import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import {
	enforceAdminRouteGate,
	enforceAuthenticationGate,
	resolveClusterContext
} from '#lib/server/request/access.js';
import { assignRequestContext, finalizeResponse } from '#lib/server/request/context.js';
import { enforceCsrfProtection } from '#lib/server/request/csrf.js';
import { normalizeHandleError, resolveRouteAndMapErrors } from '#lib/server/request/errors.js';
import {
	ensureGyreInitialized,
	getGyreInitializationStatus,
	isGyreInitialized
} from '#lib/server/request/initialization.js';
import { enforceGlobalRateLimit } from '#lib/server/request/rate-limit.js';
import { enforceRequestSizeLimits } from '#lib/server/request/request-size.js';
import { hydrateSessionLocals } from '#lib/server/request/session.js';

const readinessRoutes = new Set(['/api/ready', '/api/v1/ready']);
const initializationBypassRoutes = new Set(['/api/health', '/api/v1/health', ...readinessRoutes]);

export const handle: Handle = async ({ event, resolve }) => {
	const context = assignRequestContext(event);

	return withRequestContext(context.requestId, async () => {
		const bypassInitialization = initializationBypassRoutes.has(event.url.pathname);
		const requestSizeResult = await enforceRequestSizeLimits(event);
		if (requestSizeResult instanceof Response) {
			return finalizeResponse(event, requestSizeResult, context);
		}
		const requestEvent = requestSizeResult;

		const rateLimitResponse = enforceGlobalRateLimit(event, isGyreInitialized());
		if (rateLimitResponse) {
			return finalizeResponse(event, rateLimitResponse, context);
		}

		if (
			readinessRoutes.has(event.url.pathname) &&
			getGyreInitializationStatus().state === 'not_started'
		) {
			// Start without blocking probes; initialization records and logs failures.
			void ensureGyreInitialized().catch(() => {});
		}

		if (!bypassInitialization) {
			try {
				await ensureGyreInitialized();
			} catch (err) {
				const status = getGyreInitializationStatus();
				if (status.state !== 'failed') {
					logger.error(err, 'Failed to ensure Gyre is initialized during request handling');
				}
				const message =
					status.state === 'failed'
						? 'Gyre initialization failed'
						: 'Gyre initialization has not completed';
				const serviceUnavailableResponse = event.url.pathname.startsWith('/api/')
					? new Response(
							JSON.stringify({
								error: 'Service Unavailable',
								message
							}),
							{
								status: 503,
								headers: { 'Content-Type': 'application/json' }
							}
						)
					: new Response('Service Unavailable', { status: 503 });
				return finalizeResponse(event, serviceUnavailableResponse, context);
			}
		}

		const response = await resolveRouteAndMapErrors(requestEvent, async () => {
			// Session cookies are managed in the session helper via BETTER_AUTH_SESSION_COOKIE_NAME.
			await hydrateSessionLocals(requestEvent);

			const csrfResponse = await enforceCsrfProtection(requestEvent);
			if (csrfResponse) {
				return csrfResponse;
			}

			const authGateResponse = enforceAuthenticationGate(requestEvent);
			if (authGateResponse) {
				return authGateResponse;
			}

			await resolveClusterContext(requestEvent);

			const adminGateResponse = enforceAdminRouteGate(requestEvent);
			if (adminGateResponse) {
				return adminGateResponse;
			}

			return resolve(requestEvent);
		});
		return finalizeResponse(requestEvent, response, context);
	});
};

/**
 * HandleError - Global error handler
 */
export const handleError: HandleServerError = ({ error, kind, event }) =>
	normalizeHandleError({ error, kind, event });
