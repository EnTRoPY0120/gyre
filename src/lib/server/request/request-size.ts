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
			if (isPayloadTooLargeError(err)) {
				return createPayloadTooLargeResponse(event, err);
			}

			// Any other pipe failure (client disconnect, stream abort, upstream error)
			// leaves `readable` in an errored state. Do not hand a broken stream to
			// downstream handlers — return a stream-failure response instead.
			return new Response('Stream error', { status: 499 });
		}

		event.request = new Request(request, {
			body: readable,
			duplex: 'half'
		} as RequestInit);
	}

	return null;
}
