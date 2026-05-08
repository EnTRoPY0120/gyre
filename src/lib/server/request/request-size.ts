import { logger } from '$lib/server/logger.js';
import {
	formatSize,
	getRequestSizeLimit,
	validateRequestSize
} from '$lib/server/request-limits.js';
import type { RequestEvent } from '@sveltejs/kit';

export const STATE_CHANGING_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

export type PayloadTooLargeError = Error & {
	isPayloadTooLarge: true;
	limit: number;
	size: number;
};

export function isPayloadTooLargeError(err: unknown): err is PayloadTooLargeError {
	if (typeof err !== 'object' || err === null) return false;
	const candidate = err as Record<string, unknown>;
	return (
		candidate.isPayloadTooLarge === true &&
		typeof candidate.size === 'number' &&
		typeof candidate.limit === 'number'
	);
}

export function createPayloadTooLargeResponse(
	event: Pick<RequestEvent, 'request' | 'url'>,
	err: { limit: number; size: number }
): Response {
	const path = event.url.pathname;

	logger.warn(
		{ method: event.request.method, path, size: err.size, limit: err.limit },
		'Request size exceeded limit'
	);

	if (path.startsWith('/api/')) {
		return new Response(
			JSON.stringify({
				error: 'Payload Too Large',
				message: `Request payload exceeds maximum size of ${formatSize(err.limit)}`
			}),
			{
				status: 413,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}

	const redirectParams = new URLSearchParams(event.url.search);
	redirectParams.set('_error', 'payload_too_large');

	return new Response(null, {
		status: 303,
		headers: { Location: `${path}?${redirectParams}` }
	});
}

export async function enforceRequestSizeLimits(event: RequestEvent): Promise<Response | null> {
	const { request } = event;
	const path = event.url.pathname;
	const sizeLimit = getRequestSizeLimit(path, request.method);
	const contentLength = request.headers.get('content-length') ?? undefined;
	const sizeValidation = validateRequestSize(contentLength, sizeLimit, request.method);

	if (!sizeValidation.valid) {
		return createPayloadTooLargeResponse(event, {
			size: sizeValidation.size,
			limit: sizeValidation.limit
		});
	}

	// Streaming size guard: catches chunked/transfer-encoded requests that omit
	// Content-Length by wrapping the body in a transform that errors once the
	// configured limit is exceeded. This keeps enforcement non-blocking and
	// avoids pre-draining the request body in memory.
	if (
		request.body &&
		STATE_CHANGING_METHODS.includes(request.method) &&
		!request.headers.has('content-length')
	) {
		let bytesRead = 0;
		const transformer: Transformer<Uint8Array, Uint8Array> = {
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
		};
		const transformStream = new TransformStream(transformer);

		const readable = request.body.pipeThrough(transformStream);

		event.request = new Request(request, {
			body: readable,
			duplex: 'half'
		} as RequestInit);
	}

	return null;
}
