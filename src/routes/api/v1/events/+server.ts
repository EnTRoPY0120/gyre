import type { RequestHandler } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { subscribe, type SSEEvent } from '$lib/server/events.js';
import { logger } from '$lib/server/logger.js';
import { sseConnectionsRejectedTotal } from '$lib/server/metrics.js';
import {
	SSE_MAX_CONNECTIONS_PER_SESSION,
	SSE_MAX_CONNECTIONS_PER_USER,
	SSE_CONNECTION_TIMEOUT_MS
} from '$lib/server/config/constants.js';
import {
	acquireSseConnectionSlot,
	requireAuthenticatedUser,
	requireClusterWideRead
} from '$lib/server/http/guards.js';
import { flushSseEventQueue } from './sse-queue.js';
import { getEventConnectionContext, type EventConnectionContext } from './connection-context.js';
import { createSseCleanup } from './stream-cleanup.js';

export const _metadata = {
	GET: {
		summary: 'Subscribe to real-time events',
		description:
			'Server-Sent Events stream delivering real-time cluster resource update notifications. Each event is a JSON-encoded SSEEvent payload. Requires an active authenticated session.',
		tags: ['Events'],
		responses: {
			200: {
				description:
					'SSE stream (Content-Type: text/event-stream). Emits JSON-encoded SSEEvent objects: { type, clusterId, message, timestamp }.'
			},
			401: { description: 'Authentication required' },
			403: { description: 'Permission denied' },
			429: { description: 'Too many concurrent SSE connections' },
			500: { description: 'Internal server error' }
		}
	}
};

function acquireEventConnection(context: EventConnectionContext): {
	clusterId: string;
	release: () => void;
} {
	const connectionResult = acquireSseConnectionSlot({
		sessionId: context.sessionId,
		userId: context.userId,
		maxPerSession: SSE_MAX_CONNECTIONS_PER_SESSION,
		maxPerUser: SSE_MAX_CONNECTIONS_PER_USER
	});

	if (!connectionResult.allowed) {
		sseConnectionsRejectedTotal.labels(connectionResult.limitType).inc();
		return error(429, { message: connectionResult.reason });
	}

	return { clusterId: context.clusterId, release: connectionResult.release };
}

export const GET: RequestHandler = async ({ request, locals, getClientAddress }) => {
	const user = requireAuthenticatedUser(locals);

	await requireClusterWideRead(locals);

	const rawSessionId = locals.session?.id;
	if (!rawSessionId) {
		logger.warn(
			'[SSE] Authenticated user has no session ID; falling back to IP for connection limiting'
		);
	}
	const connectionContext = getEventConnectionContext(
		user.id,
		locals.cluster,
		rawSessionId,
		getClientAddress
	);
	const { clusterId, release } = acquireEventConnection(connectionContext);
	// Shared cleanup ref so both start() and cancel() can invoke the same teardown.
	// start() is called synchronously during ReadableStream construction, so
	// cleanupRef is always populated before cancel() can fire.
	let cleanupRef: (() => void) | null = null;
	let attemptFlushRef: (() => void) | null = null;

	// Create a ReadableStream for SSE
	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();
			let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
			let unsubscribe: () => void;

			const cleanupController = createSseCleanup({
				release,
				close: () => controller.close()
			});
			const { cleanup } = cleanupController;
			cleanupRef = cleanup;

			const EVENT_BUFFER_LIMIT = 100;
			const eventQueue: Uint8Array[] = [];

			const attemptFlush = () => flushSseEventQueue(eventQueue, controller, cleanup);
			attemptFlushRef = attemptFlush;

			try {
				// Subscribe to the centralized event bus
				unsubscribe = subscribe((event: SSEEvent) => {
					const encoded = encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
					if (eventQueue.length >= EVENT_BUFFER_LIMIT) {
						logger.warn({ clusterId }, '[SSE] Event buffer full, closing connection');
						cleanup();
						return;
					}
					eventQueue.push(encoded);
					attemptFlush();
					// Only check for SHUTDOWN if enqueue succeeded (controller is still open)
					// Note: unsubscribe() calls ctx.subscribers.delete(subscriber) while broadcast() iterates the Set.
					// This is safe in JS (current element deletion during for...of is safe).
					if (event.type === 'SHUTDOWN') {
						cleanup();
					}
				}, clusterId);
				cleanupController.setUnsubscribe(unsubscribe);

				// Optional per-connection timeout: send SHUTDOWN and close the stream
				// so the client reconnects. Disabled when SSE_CONNECTION_TIMEOUT_MS === 0.
				if (SSE_CONNECTION_TIMEOUT_MS > 0) {
					timeoutHandle = setTimeout(() => {
						const timeoutEvent: SSEEvent = {
							type: 'SHUTDOWN',
							clusterId,
							message: 'Connection timeout – please reconnect',
							timestamp: new Date().toISOString(),
							reason: 'connection_timeout'
						};
						try {
							controller.enqueue(encoder.encode(`data: ${JSON.stringify(timeoutEvent)}\n\n`));
						} catch {
							// ignore – cleanup will close the controller
						}
						cleanup();
					}, SSE_CONNECTION_TIMEOUT_MS);
					cleanupController.setTimeoutHandle(timeoutHandle);
				}

				// Handle client disconnect
				request.signal.addEventListener('abort', () => {
					cleanup();
				});
			} catch (err) {
				cleanup();
				throw err;
			}
		},
		pull() {
			// Consumer wants more data — drain buffered events respecting desiredSize
			attemptFlushRef?.();
		},
		cancel() {
			// Called when the consumer cancels the stream (e.g. response.body.cancel()).
			// Without this, disconnects that bypass request.signal would leak the slot.
			cleanupRef?.();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
};
