import type { RequestHandler } from '@sveltejs/kit';
import { subscribe, type SSEEvent } from '$lib/server/events.js';

export const GET: RequestHandler = async ({ request, locals }) => {
	// Create a ReadableStream for SSE
	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();

			// Subscribe to the centralized event bus
			const unsubscribe = subscribe((event: SSEEvent) => {
				const msg = `data: ${JSON.stringify(event)}\n\n`;
				try {
					controller.enqueue(encoder.encode(msg));
				} catch {
					// Controller may be closed, unsubscribe
					unsubscribe();
				}
			}, locals.cluster);

			// Handle client disconnect
			request.signal.addEventListener('abort', () => {
				unsubscribe();
				try {
					controller.close();
				} catch {
					// Controller may already be closed
				}
			});
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
