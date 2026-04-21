import {
	MAX_RECONNECT_ATTEMPTS,
	RECONNECT_DELAY_MS,
	MAX_RECONNECT_DELAY_MS
} from '$lib/config/constants';

export const DEFAULT_CONNECTION_OPTIONS = {
	maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
	reconnectDelay: RECONNECT_DELAY_MS,
	maxReconnectDelay: MAX_RECONNECT_DELAY_MS
};

export function getReconnectDelay(attempt: number): number {
	return Math.min(
		DEFAULT_CONNECTION_OPTIONS.reconnectDelay * Math.pow(2, attempt),
		DEFAULT_CONNECTION_OPTIONS.maxReconnectDelay
	);
}
