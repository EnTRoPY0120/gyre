import {
	MAX_RECONNECT_ATTEMPTS,
	RECONNECT_DELAY_MS,
	MAX_RECONNECT_DELAY_MS
} from '$lib/config/constants';

export const DEFAULT_CONNECTION_OPTIONS = Object.freeze({
	maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
	reconnectDelay: RECONNECT_DELAY_MS,
	maxReconnectDelay: MAX_RECONNECT_DELAY_MS
});

export function getReconnectDelay(attempt: number): number {
	const baseDelay = Math.min(
		DEFAULT_CONNECTION_OPTIONS.reconnectDelay * Math.pow(2, Math.max(0, attempt)),
		DEFAULT_CONNECTION_OPTIONS.maxReconnectDelay
	);
	const jitteredDelay = baseDelay / 2 + Math.random() * (baseDelay / 2);
	return Math.min(jitteredDelay, DEFAULT_CONNECTION_OPTIONS.maxReconnectDelay);
}
