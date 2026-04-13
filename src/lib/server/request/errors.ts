import { errorToHttpResponse } from '$lib/server/kubernetes/errors.js';
import { logger } from '$lib/server/logger.js';
import { normalizeError } from '$lib/utils/error-normalization.js';
import { isHttpError, isRedirect, type RequestEvent, type ResolveOptions } from '@sveltejs/kit';
import { createPayloadTooLargeResponse, isPayloadTooLargeError } from './request-size.js';

export async function resolveRouteAndMapErrors(
	event: RequestEvent,
	resolve: (event: RequestEvent, opts?: ResolveOptions) => Response | Promise<Response>
): Promise<Response> {
	const path = event.url.pathname;

	if (path.startsWith('/api/')) {
		try {
			return await resolve(event);
		} catch (err) {
			if (isPayloadTooLargeError(err)) {
				return createPayloadTooLargeResponse(event, err);
			}

			if (isRedirect(err) || isHttpError(err)) {
				throw err;
			}

			logger.error(err, `Unhandled error in API route ${path}:`);
			const { status, body } = errorToHttpResponse(err);
			return new Response(JSON.stringify(body), {
				status,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	}

	try {
		return await resolve(event);
	} catch (err) {
		if (isPayloadTooLargeError(err)) {
			return createPayloadTooLargeResponse(event, err);
		}
		throw err;
	}
}

export function normalizeHandleError({
	error,
	event
}: {
	error: unknown;
	event: { locals?: App.Locals; url: URL };
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
