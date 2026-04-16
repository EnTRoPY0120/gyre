import type { RequestHandler } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { IN_CLUSTER_ID } from '$lib/clusters/identity.js';
import { subscribe, type SSEEvent } from '$lib/server/events.js';
import { checkClusterWideReadPermission } from '$lib/server/rbac.js';
import { sseConnectionLimiter } from '$lib/server/rate-limiter.js';
import { logger } from '$lib/server/logger.js';
import { sseConnectionsRejectedTotal } from '$lib/server/metrics.js';
import {
	SSE_MAX_CONNECTIONS_PER_SESSION,
	SSE_MAX_CONNECTIONS_PER_USER,
	SSE_CONNECTION_TIMEOUT_MS
} from '$lib/server/config/constants.js';

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

export const GET: RequestHandler = async ({ request, locals, getClientAddress }) => {
	// Check authentication
	if (!locals.user) {
		return error(401, { message: 'Authentication required' });
	}

	const clusterId = locals.cluster ?? IN_CLUSTER_ID;

	// Check permission
	const hasPermission = await checkClusterWideReadPermission(locals.user, clusterId);
	if (!hasPermission) {
		return error(403, { message: 'Permission denied' });
	}

	// Enforce per-session and per-user concurrent connection limits.
	// Session ID is preferred over client IP because IP addresses can be shared
	// across many users (NAT, VPN, corporate proxies).
	const rawSessionId = locals.session?.id;
	if (!rawSessionId) {
		logger.warn(
			'[SSE] Authenticated user has no session ID; falling back to IP for connection limiting'
		);
	}
	const sessionId = rawSessionId ?? getClientAddress();
	const userId = String(locals.user.id);

	const connectionResult = sseConnectionLimiter.acquire(
		sessionId,
		userId,
		SSE_MAX_CONNECTIONS_PER_SESSION,
		SSE_MAX_CONNECTIONS_PER_USER
	);

	if (!connectionResult.allowed) {
		sseConnectionsRejectedTotal.labels(connectionResult.limitType).inc();
		return error(429, { message: connectionResult.reason });
	}

	const { release } = connectionResult;
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

			// Idempotency guard: cleanup may be triggered from multiple paths
			// (abort signal, ReadableStream cancel(), SHUTDOWN event, buffer overflow).
			// Without this flag, release() would be called multiple times, corrupting
			// the per-session/per-user connection slot count.
			let isCleanedUp = false;
			const cleanup = () => {
				if (isCleanedUp) return;
				isCleanedUp = true;
				release();
				unsubscribe?.();
				if (timeoutHandle) {
					clearTimeout(timeoutHandle);
					timeoutHandle = null;
				}
				try {
					controller.close();
				} catch {
					// Controller may already be closed
				}
			};

			cleanupRef = cleanup;

			const EVENT_BUFFER_LIMIT = 100;
			const eventQueue: Uint8Array[] = [];

			const attemptFlush = () => {
				while (eventQueue.length > 0 && (controller.desiredSize ?? 1) > 0) {
					try {
						controller.enqueue(eventQueue.shift()!);
					} catch {
						cleanup();
						return;
					}
				}
			};
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
