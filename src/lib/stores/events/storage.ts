import { IN_CLUSTER_ID } from '$lib/clusters/identity.js';
import {
	parseStoredNotificationState,
	type NotificationState,
	type StoredNotificationState
} from './helpers.js';
import type { NotificationMessage } from './types.js';

export interface NotificationStorageKeys {
	notifications: string;
	state: string;
}

export interface NotificationStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

export interface PersistedNotificationData {
	notifications: NotificationMessage[];
	state: StoredNotificationState;
}

interface StorageLogger {
	warn(...args: unknown[]): void;
	error(...args: unknown[]): void;
}

export function loadNotificationStorage(
	storage: NotificationStorage,
	keys: NotificationStorageKeys,
	logger: StorageLogger
): PersistedNotificationData {
	try {
		const storedNotifications = storage.getItem(keys.notifications);
		const notifications = storedNotifications
			? (JSON.parse(storedNotifications) as NotificationMessage[]).map((notification) => ({
					...notification,
					clusterId: notification.clusterId || IN_CLUSTER_ID,
					timestamp: new Date(notification.timestamp)
				}))
			: [];

		const storedState = storage.getItem(keys.state);
		const state = storedState
			? parseStoredNotificationState(JSON.parse(storedState))
			: { entries: [] };

		return { notifications, state };
	} catch (error) {
		logger.error(error, '[Storage] Failed to load persisted notifications:');
		storage.removeItem(keys.notifications);
		storage.removeItem(keys.state);
		return { notifications: [], state: { entries: [] } };
	}
}

export function saveNotificationStorage({
	storage,
	keys,
	notifications,
	state,
	sessionId,
	logger,
	maxNotifications
}: {
	storage: NotificationStorage;
	keys: NotificationStorageKeys;
	notifications: NotificationMessage[];
	state: Map<string, NotificationState>;
	sessionId: string | null;
	logger: StorageLogger;
	maxNotifications: number;
}): void {
	try {
		storage.setItem(keys.notifications, JSON.stringify(notifications.slice(0, maxNotifications)));
		storage.setItem(
			keys.state,
			JSON.stringify({ sessionId, entries: Array.from(state.entries()) })
		);
	} catch (error) {
		if (isQuotaExceededError(error)) {
			try {
				storage.removeItem(keys.state);
				storage.setItem(
					keys.notifications,
					JSON.stringify(notifications.slice(0, Math.floor(maxNotifications / 2)))
				);
				logger.warn('[Storage] localStorage quota exceeded, saved reduced notification set');
			} catch {
				storage.removeItem(keys.notifications);
				storage.removeItem(keys.state);
				logger.warn('[Storage] localStorage quota exceeded, cleared notifications storage');
			}
		} else {
			logger.error(error, '[Storage] Failed to persist notifications:');
		}
	}
}

function isQuotaExceededError(error: unknown): boolean {
	return error instanceof DOMException && error.name === 'QuotaExceededError';
}
