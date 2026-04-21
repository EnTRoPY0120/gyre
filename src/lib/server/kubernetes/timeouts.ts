import * as k8s from '@kubernetes/client-node';

// ---------------------------------------------------------------------------
// Timeout configuration
// ---------------------------------------------------------------------------

/** Default timeout for all Kubernetes API requests (30 seconds). */
export const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Per-operation timeout overrides (ms). Falls back to DEFAULT_TIMEOUT_MS.
 * "logs" is higher because log fetching can be slow on large pods.
 * "delete" has same timeout as create/update operations.
 */
export const OPERATION_TIMEOUTS: Record<string, number> = {
	list: 30_000,
	get: 15_000,
	create: 30_000,
	update: 30_000,
	delete: 30_000,
	logs: 60_000
};

/** Returns a PromiseMiddleware that aborts requests exceeding `timeoutMs`. Exported for testing. */
export function _createTimeoutMiddleware(timeoutMs: number): k8s.Middleware {
	return {
		pre: async (ctx: k8s.RequestContext) => {
			const controller = new AbortController();
			const existingSignal = ctx.getSignal();

			// Declared before timer so the closure captures the binding correctly.
			let timer: ReturnType<typeof setTimeout>;

			// If a caller passed an upstream signal (e.g. a request-level AbortController),
			// propagate its cancellation: clear our timer and abort our controller.
			const onUpstreamAbort = () => {
				clearTimeout(timer);
				controller.abort();
			};
			if (existingSignal) {
				existingSignal.addEventListener('abort', onUpstreamAbort, { once: true });
			}

			timer = setTimeout(() => {
				// Timeout fired — remove the upstream listener so it cannot fire later.
				if (existingSignal) {
					existingSignal.removeEventListener('abort', onUpstreamAbort);
				}
				controller.abort();
			}, timeoutMs);
			if (typeof timer === 'object' && 'unref' in timer) {
				timer.unref();
			}

			controller.signal.addEventListener(
				'abort',
				() => {
					clearTimeout(timer);
					if (existingSignal) {
						existingSignal.removeEventListener('abort', onUpstreamAbort);
					}
				},
				{ once: true }
			);

			ctx.setSignal(controller.signal);
			return ctx;
		},
		// ResponseContext does not expose the request signal, so timer cleanup on
		// successful completion is handled by the setTimeout firing as a no-op once
		// the fetch promise has already settled.
		post: async (ctx: k8s.ResponseContext) => ctx
	};
}
