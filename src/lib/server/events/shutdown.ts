import { logger } from '../logger.js';
import { activeWorkers, setEventBusShuttingDown } from './state.js';
import { activeWorkersGauge, sseSubscribersGauge } from '../metrics.js';
import { broadcast, stopWorker } from './bus.js';
import { normalizeError } from './types.js';

export { setEventBusShuttingDown } from './state.js';

/**
 * Mark the event bus as shutting down to prevent new subscriptions
 */
export async function closeAllEventStreams() {
	logger.info('[EventBus] Shutting down all event streams...');
	setEventBusShuttingDown();

	// Collect inflight promises before touching any context so the broadcast loop
	// below is not delayed by sequential awaits.
	const inflightPromises: Array<[string, Promise<void>]> = [];
	for (const [clusterId, context] of Array.from(activeWorkers.entries())) {
		if (context.inflightPollPromise) {
			inflightPromises.push([clusterId, context.inflightPollPromise]);
		}

		// Broadcast SHUTDOWN to all subscribers - this will trigger their unsubscribe()
		// which will call stopWorker and remove from activeWorkers
		broadcast(context, {
			type: 'SHUTDOWN',
			clusterId,
			timestamp: new Date().toISOString(),
			reason: 'server_shutdown'
		});
		// Explicitly call stopWorker to guarantee timer cleanup even if a subscriber throws.
		// It is safe if stopWorker is called twice (idempotent check for null intervals).
		stopWorker(context, 'server shutdown');

		// Subscribers are cleared by their unsubscribe callbacks during broadcast.
		// The guard exists because unsubscribe() may have already called activeWorkers.delete(clusterId)
		// during the broadcast, modifying the Map during live iteration.
		if (activeWorkers.has(clusterId)) {
			context.subscribers.clear();
		}
	}

	// Await all inflight polls concurrently now that all workers are stopped.
	const pollResults = await Promise.allSettled(inflightPromises.map(([, p]) => p));
	pollResults.forEach((result, i) => {
		if (result.status === 'rejected') {
			logger.error(
				{ clusterId: inflightPromises[i][0], err: normalizeError(result.reason) },
				'[EventBus] Error awaiting poll'
			);
		}
	});
	activeWorkers.clear();
	// Reset metrics
	activeWorkersGauge.set(0);
	sseSubscribersGauge.reset();
}
