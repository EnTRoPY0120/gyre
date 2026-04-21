import type { ClusterContext } from './types.js';

export const SERVER_SESSION_ID = Date.now().toString(36);

// Worker state is scoped by canonical cluster ID and discarded when the final subscriber leaves.
export const activeWorkers = new Map<string, ClusterContext>();

export let isShuttingDown = false;

export function setEventBusShuttingDown(): void {
	isShuttingDown = true;
}
