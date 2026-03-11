import type { RequestHandler } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { subscribe, type SSEEvent } from '$lib/server/events.js';
import { checkPermission } from '$lib/server/rbac.js';
import { sseConnectionLimiter } from '$lib/server/rate-limiter.js';
import { sseConnectionsRejectedTotal } from '$lib/server/metrics.js';
import {
	SSE_MAX_CONNECTIONS_PER_SESSION,
	SSE_MAX_CONNECTIONS_PER_USER,
	SSE_CONNECTION_TIMEOUT_MS
} from '$lib/server/config/constants.js';

export const GET: RequestHandler = async ({ request, locals, getClientAddress }) => {
	// Check authentication
	if (!locals.user) {
		return error(401, { message: 'Authentication required' });
	}

	// Check permission
	const hasPermission = await checkPermission(
		locals.user,
		'read',
		undefined,
		undefined,
		locals.cluster
	);
	if (!hasPermission) {
		return error(403, { message: 'Permission denied' });
	}

	// Enforce per-session and per-user concurrent connection limits.
	// Session ID is preferred over client IP because IP addresses can be shared
	// across many users (NAT, VPN, corporate proxies).
	const sessionId = locals.session?.id ?? getClientAddress();
	const userId = String(locals.user.id);

	const connectionResult = sseConnectionLimiter.acquire(
		sessionId,
		userId,
		SSE_MAX_CONNECTIONS_PER_SESSION,
		SSE_MAX_CONNECTIONS_PER_USER
	);

	if (!connectionResult.allowed) {
		const reason = connectionResult.reason.includes('session') ? 'session_limit' : 'user_limit';
		sseConnectionsRejectedTotal.labels(reason).inc();
		return error(429, { message: connectionResult.reason });
	}

	const { release } = connectionResult;

	// Create a ReadableStream for SSE
	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();
			let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
			let unsubscribe: () => void;

			const cleanup = () => {
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

			// Subscribe to the centralized event bus
			unsubscribe = subscribe((event: SSEEvent) => {
				const msg = `data: ${JSON.stringify(event)}\n\n`;
				try {
					controller.enqueue(encoder.encode(msg));
				} catch {
					// Enqueue failed (e.g., controller closed or client disconnected abruptly)
					cleanup();
					return;
				}
				// Only check for SHUTDOWN if enqueue succeeded (controller is still open)
				// Note: unsubscribe() calls ctx.subscribers.delete(subscriber) while broadcast() iterates the Set.
				// This is safe in JS (current element deletion during for...of is safe).
				if (event.type === 'SHUTDOWN') {
					cleanup();
				}
			}, locals.cluster);

			// Optional per-connection timeout: send SHUTDOWN and close the stream
			// so the client reconnects. Disabled when SSE_CONNECTION_TIMEOUT_MS === 0.
			if (SSE_CONNECTION_TIMEOUT_MS > 0) {
				timeoutHandle = setTimeout(() => {
					const timeoutEvent: SSEEvent = {
						type: 'SHUTDOWN',
						message: 'Connection timeout – please reconnect',
						timestamp: new Date().toISOString()
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
