import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, test, vi } from 'vitest';

vi.mock('#lib/server/logger.js', () => ({ logger: { warn: vi.fn() } }));
vi.mock('#lib/server/config.js', () => ({ ADMIN_ROUTE_PREFIXES: ['/api/admin', '/api/v1/admin'] }));

import {
	enforceRequestSizeLimits,
	isPayloadTooLargeError
} from '#lib/server/request/request-size.js';
import { REQUEST_LIMITS } from '#lib/server/request-limits.js';

function createFrozenEvent(request: Request): RequestEvent {
	return Object.freeze({ request, url: new URL(request.url) }) as unknown as RequestEvent;
}

function getRequestEvent(result: Response | RequestEvent): RequestEvent {
	if (result instanceof Response) {
		throw new Error(`Expected a request event, received HTTP ${result.status}`);
	}
	return result;
}

describe('enforceRequestSizeLimits', () => {
	test('copies a frozen event and rejects an oversized chunked body while streaming', async () => {
		const request = new Request('http://localhost/api/v1/import', {
			method: 'POST',
			body: new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(new Uint8Array(REQUEST_LIMITS.JSON_API + 1));
					controller.close();
				}
			}),
			duplex: 'half'
		} as RequestInit);
		const event = createFrozenEvent(request);

		const guardedEvent = getRequestEvent(await enforceRequestSizeLimits(event));

		expect(guardedEvent).not.toBe(event);
		expect(guardedEvent.request).not.toBe(request);
		expect(event.request).toBe(request);

		const reader = guardedEvent.request.body?.getReader();
		expect(reader).toBeDefined();
		const streamError = await reader!.read().then(
			() => null,
			(error: unknown) => error
		);
		expect(isPayloadTooLargeError(streamError)).toBe(true);
		if (isPayloadTooLargeError(streamError)) {
			expect(streamError.limit).toBe(REQUEST_LIMITS.JSON_API);
			expect(streamError.size).toBe(REQUEST_LIMITS.JSON_API + 1);
		}
	});

	test('returns the original event when no request needs a streaming guard', async () => {
		const event = createFrozenEvent(new Request('http://localhost/api/v1/status'));

		expect(await enforceRequestSizeLimits(event)).toBe(event);
	});

	test.each([
		['oversized', String(REQUEST_LIMITS.JSON_API + 1), 413],
		['malformed', '1MB', 400]
	])('keeps the existing %s Content-Length response', async (_label, contentLength, status) => {
		const event = createFrozenEvent(
			new Request('http://localhost/api/v1/import', {
				method: 'POST',
				headers: { 'Content-Length': contentLength }
			})
		);

		const result = await enforceRequestSizeLimits(event);

		expect(result).toBeInstanceOf(Response);
		if (!(result instanceof Response)) throw new Error('Expected a rejection response');
		expect(result.status).toBe(status);
		expect(event.request.headers.get('content-length')).toBe(contentLength);
	});
});
