import { logger } from '../logger.js';
import { normalizeError, type ClusterContext, type SSEEvent } from './types.js';

export function broadcast(context: ClusterContext, event: SSEEvent) {
	// The loop is fault-tolerant: if a subscriber callback throws (e.g. during SHUTDOWN due to a closed stream),
	// it is caught and logged, ensuring remaining subscribers still receive the event.
	for (const subscriber of context.subscribers) {
		try {
			subscriber(event);
		} catch (err) {
			if (event.type === 'SHUTDOWN') {
				logger.debug(
					{ clusterId: context.clusterId, err: normalizeError(err) },
					'[EventBus] Error broadcasting SHUTDOWN to subscriber'
				);
			} else {
				logger.error(
					{ clusterId: context.clusterId, err: normalizeError(err) },
					'[EventBus] Error broadcasting to subscriber'
				);
			}
		}
	}
}
