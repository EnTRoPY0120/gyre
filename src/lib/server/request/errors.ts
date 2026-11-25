import { errorToHttpResponse } from '#lib/server/kubernetes/errors.js';
import { logger } from '#lib/server/logger.js';
import { normalizeError } from '#lib/utils/error-normalization.js';
import { isHttpError, isRedirect, type RequestEvent } from '@sveltejs/kit';
import type { ResolveOptions } from '@sveltejs/kit/hooks';
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

type ErrorHookKind = 'app' | 'framework' | 'validation' | 'unknown';

type ErrorHookInput = {
	error: unknown;
	kind: ErrorHookKind;
	event: { locals?: { requestId?: string }; url: URL };
};

export function normalizeHandleError({ error, kind, event }: ErrorHookInput): App.Error {
	const { code, status: fallbackStatus } = normalizeError(error);

	if (kind === 'unknown') {
		const requestId = event.locals?.requestId;
		if (requestId) {
			logger.error(error, `Error in ${event.url.pathname}:`, { requestId });
		} else {
			logger.error(error, `Error in ${event.url.pathname}:`);
		}

		return { status: fallbackStatus, message: 'An unexpected error occurred', code };
	}

	const caughtError = error as { message?: unknown; status?: unknown };
	return {
		status:
			typeof caughtError.status === 'number' && Number.isInteger(caughtError.status)
				? caughtError.status
				: fallbackStatus,
		message: typeof caughtError.message === 'string' ? caughtError.message : 'Internal Error',
		code
	};
}
