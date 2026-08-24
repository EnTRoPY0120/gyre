/**
 * Real-time notification store using Server-Sent Events (SSE)
 * Falls back to polling if SSE is not available
 */

export * from './events/types.js';

import { IN_CLUSTER_ID, normalizeClusterId } from '$lib/clusters/identity.js';
import { preferences } from './preferences.svelte';
import { clusterStore } from './cluster.svelte';
import { logger } from '$lib/utils/logger.js';
import {
	MAX_RECONNECT_ATTEMPTS,
	RECONNECT_DELAY_MS,
	MAX_RECONNECT_DELAY_MS,
	MAX_NOTIFICATIONS,
	MESSAGE_PREVIEW_LENGTH
} from '$lib/config/constants';
import type {
	ConnectionStatus,
	EventCallback,
	NotificationMessage,
	ResourceEvent,
	StatusCallback
} from './events/types.js';
import {
	getEventControlAction,
	buildNotification,
	prepareNotification,
	parseStoredNotificationState,
	type EventControlAction,
	type NotificationState
} from './events/helpers.js';

function hashStorageUserIdentity(value: string): string {
	let hash = 0xcbf29ce484222325n;
	for (const byte of new TextEncoder().encode(value)) {
		hash ^= BigInt(byte);
		hash = BigInt.asUintN(64, hash * 0x100000001b3n);
	}
	return hash.toString(16).padStart(16, '0');
}

class RealtimeStore {
	private eventSource: EventSource | null = null;
	private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = MAX_RECONNECT_ATTEMPTS;
	private reconnectDelay = RECONNECT_DELAY_MS;
	private eventCallbacks: Set<EventCallback> = new Set();
	private statusCallbacks: Set<StatusCallback> = new Set();
	private isServerShutdown = false;

	// Notification state cache to prevent duplicate notifications
	// Key: `${clusterId}/${resourceType}/${namespace}/${name}`, Value: NotificationState object
	private lastNotificationState: Map<string, NotificationState> = new Map();

	// Tracks the server process session; used to detect server restarts and clear stale state
	private lastServerSessionId: string | null = null;
	private storageClusterId = $state<string>(normalizeClusterId(clusterStore.current));
	private storageUserIdentity = $state<string | null>(null);

	// Reactive state using Svelte 5 runes
	status = $state<ConnectionStatus>('disconnected');
	notifications = $state<NotificationMessage[]>([]);
	unreadCount = $derived(this.notifications.filter((n) => !n.read).length);

	/**
	 * Derived unread count per cluster
	 * Returns a map of clusterId to unread count
	 */
	clusterUnreadCounts = $derived.by(() => {
		const counts: Record<string, number> = {};
		this.notifications.forEach((n) => {
			if (!n.read) {
				counts[n.clusterId] = (counts[n.clusterId] || 0) + 1;
			}
		});
		return counts;
	});

	constructor() {
		// Load persisted notifications and state on initialization (browser only)
		if (typeof window !== 'undefined') {
			this.loadFromStorage();
		}
	}

	private getStorageKeys() {
		const clusterId = normalizeClusterId(this.storageClusterId);
		const userScope = this.storageUserIdentity
			? hashStorageUserIdentity(this.storageUserIdentity)
			: 'anonymous';
		return {
			notifications: `gyre_notifications_${clusterId}_${userScope}`,
			state: `gyre_notification_state_${clusterId}_${userScope}`
		};
	}

	setStorageScope({
		clusterId,
		userIdentity
	}: {
		clusterId?: string | null;
		userIdentity?: string | null;
	}) {
		const nextClusterId = normalizeClusterId(clusterId ?? this.storageClusterId);
		const nextUserIdentity = userIdentity ?? null;
		if (nextClusterId === this.storageClusterId && nextUserIdentity === this.storageUserIdentity) {
			return;
		}

		this.storageClusterId = nextClusterId;
		this.storageUserIdentity = nextUserIdentity;
		this.notifications = [];
		this.lastNotificationState.clear();
		this.lastServerSessionId = null;
		this.loadFromStorage();
	}

	private loadFromStorage() {
		const keys = this.getStorageKeys();
		try {
			// Load notifications for the current cluster
			const storedNotifications = localStorage.getItem(keys.notifications);
			if (storedNotifications) {
				const parsed = JSON.parse(storedNotifications);
				// Convert timestamp strings back to Date objects and ensure clusterId exists
				this.notifications = parsed.map((n: NotificationMessage) => ({
					...n,
					clusterId: n.clusterId || IN_CLUSTER_ID,
					timestamp: new Date(n.timestamp)
				}));
			}

			// Load notification state cache (handles legacy string format and current object format)
			const storedState = localStorage.getItem(keys.state);
			if (storedState) {
				const parsed = JSON.parse(storedState);
				const restoredState = parseStoredNotificationState(parsed);
				this.lastNotificationState = new Map(restoredState.entries);
				if (restoredState.sessionId) this.lastServerSessionId = restoredState.sessionId;
			}
		} catch (err) {
			logger.error(err, '[Storage] Failed to load persisted notifications:');
			// Clear corrupted data
			localStorage.removeItem(keys.notifications);
			localStorage.removeItem(keys.state);
		}
	}

	private saveToStorage() {
		if (typeof window === 'undefined') return;

		const keys = this.getStorageKeys();
		try {
			// Save only the most recent notifications to avoid localStorage quota issues.
			const toSave = this.notifications.slice(0, MAX_NOTIFICATIONS);
			localStorage.setItem(keys.notifications, JSON.stringify(toSave));

			// Save notification state cache with sessionId for cross-reload desync detection
			const stateArray = Array.from(this.lastNotificationState.entries());
			localStorage.setItem(
				keys.state,
				JSON.stringify({ sessionId: this.lastServerSessionId, entries: stateArray })
			);
		} catch (err) {
			if (err instanceof DOMException && err.name === 'QuotaExceededError') {
				try {
					const reduced = this.notifications.slice(0, Math.floor(MAX_NOTIFICATIONS / 2));
					localStorage.removeItem(keys.state);
					localStorage.setItem(keys.notifications, JSON.stringify(reduced));
					logger.warn('[Storage] localStorage quota exceeded, saved reduced notification set');
				} catch {
					localStorage.removeItem(keys.notifications);
					localStorage.removeItem(keys.state);
					logger.warn('[Storage] localStorage quota exceeded, cleared notifications storage');
				}
			} else {
				logger.error(err, '[Storage] Failed to persist notifications:');
			}
		}
	}

	connect() {
		if (this.isServerShutdown) {
			// In development, the server may have restarted (HMR) while client is alive.
			// Allow reconnecting in dev mode.
			if (import.meta.env.DEV) {
				this.isServerShutdown = false;
			} else {
				return;
			}
		}

		if (this.eventSource?.readyState === EventSource.OPEN) {
			return;
		}

		// Only connect in browser environment
		if (typeof window === 'undefined') {
			return;
		}

		this.status = 'connecting';
		this.notifyStatusChange('connecting');

		const sseUrl = '/api/v1/events';

		try {
			this.eventSource = new EventSource(sseUrl);
			const es = this.eventSource;

			es.onopen = () => {
				if (this.eventSource !== es) return;
				this.status = 'connected';
				this.reconnectAttempts = 0;
				this.notifyStatusChange('connected');
				logger.info('[SSE] Connected to event stream');
			};

			es.onmessage = (event) => {
				if (this.eventSource !== es) return;
				try {
					const data: ResourceEvent = JSON.parse(event.data);
					this.handleMessage(data);
				} catch (err) {
					logger.error(err, '[SSE] Failed to parse message:');
				}
			};

			es.onerror = () => {
				if (this.eventSource !== es) return;
				const rs = es.readyState;
				if (rs === EventSource.CLOSED) {
					logger.info('[SSE] Connection closed');
					this.status = 'disconnected';
					this.notifyStatusChange('disconnected');
				} else {
					logger.warn('[SSE] Connection error');
					this.status = 'error';
					this.notifyStatusChange('error');
				}
				es.close();
				this.eventSource = null;
				this.scheduleReconnect();
			};
		} catch (err) {
			logger.error(err, '[SSE] Failed to connect:');
			this.status = 'error';
			this.notifyStatusChange('error');
			this.scheduleReconnect();
		}
	}

	disconnect() {
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}

		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
		}

		this.status = 'disconnected';
		this.notifyStatusChange('disconnected');
	}

	destroy() {
		// Clean up all resources when the store is destroyed
		this.disconnect();
		this.eventCallbacks.clear();
		this.statusCallbacks.clear();
	}

	private scheduleReconnect() {
		if (this.isServerShutdown) {
			// In development, the server may have restarted (HMR) while the client is alive.
			// Allow reconnecting in dev mode; in production, respect the shutdown signal.
			if (import.meta.env.DEV) {
				this.isServerShutdown = false;
			} else {
				return;
			}
		}

		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			logger.warn('[SSE] Max reconnect attempts reached, giving up');
			this.status = 'error';
			this.notifyStatusChange('error');
			return;
		}

		const delay = Math.min(
			this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
			MAX_RECONNECT_DELAY_MS
		);
		this.reconnectAttempts++;

		logger.debug(`[SSE] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

		this.reconnectTimeout = setTimeout(() => {
			this.connect();
		}, delay);
	}

	private handleControlEvent(event: ResourceEvent, controlAction: EventControlAction): boolean {
		if (!controlAction) return false;

		if (controlAction.type === 'shutdown') {
			this.handleShutdownEvent(event, controlAction.permanent);
			return true;
		}

		if (controlAction.type === 'heartbeat') return true;

		this.handleConnectedEvent(controlAction);
		return true;
	}

	private handleShutdownEvent(event: ResourceEvent, permanent: boolean) {
		logger.info(
			`[SSE] Received SHUTDOWN event from server (reason: ${event.reason || 'unknown'}), disconnecting and ${
				permanent ? 'preventing' : 'allowing'
			} reconnects.`
		);
		this.isServerShutdown = permanent;
		this.disconnect();
		if (!permanent) this.scheduleReconnect();
	}

	private handleConnectedEvent(controlAction: Extract<EventControlAction, { type: 'connected' }>) {
		if (controlAction.sessionChanged) {
			logger.info('[SSE] Server session changed, clearing local notification state');
			this.lastNotificationState.clear();
		}
		if (controlAction.sessionId) {
			this.lastServerSessionId = controlAction.sessionId;
			this.saveToStorage();
		}
	}

	private handleMessage(data: ResourceEvent) {
		const controlAction = getEventControlAction(data, this.lastServerSessionId);
		if (this.handleControlEvent(data, controlAction)) return;

		this.eventCallbacks.forEach((callback) => {
			try {
				callback(data);
			} catch (err) {
				logger.error(err, '[SSE] Error in event callback:');
			}
		});

		if (data.resource) this.addNotification(data);
	}

	private addNotification(event: ResourceEvent) {
		const candidate = prepareNotification(
			event,
			this.lastNotificationState,
			(resourceType, namespace, type) =>
				preferences.shouldShowNotification(resourceType, namespace, type),
			MESSAGE_PREVIEW_LENGTH,
			IN_CLUSTER_ID
		);
		if (!candidate) return;

		if (candidate.isDuplicate) {
			logger.debug(
				`[Notification] Skipping duplicate for ${candidate.resourceKey}: state unchanged (revision: ${candidate.currentState.revision || 'none'})`
			);
			return;
		}

		this.lastNotificationState.set(candidate.resourceKey, candidate.currentState);
		if (candidate.previousState) {
			logger.debug(
				`[Notification] State change for ${candidate.resourceKey}: revision "${candidate.previousState.revision || 'none'}" -> "${candidate.currentState.revision || 'none'}", ready: ${candidate.currentState.readyStatus}`
			);
		} else {
			logger.debug(
				`[Notification] New notification for ${candidate.resourceKey}: ${event.type}, revision: ${candidate.currentState.revision || 'none'}`
			);
		}

		const notification = buildNotification(event, candidate.clusterId, candidate.type);
		this.notifications = [notification, ...this.notifications.slice(0, MAX_NOTIFICATIONS - 1)];
		this.saveToStorage();
	}

	private notifyStatusChange(status: ConnectionStatus) {
		this.statusCallbacks.forEach((callback) => {
			try {
				callback(status);
			} catch (err) {
				logger.error(err, '[SSE] Error in status callback:');
			}
		});
	}

	// Subscribe to resource events
	onEvent(callback: EventCallback): () => void {
		this.eventCallbacks.add(callback);
		return () => {
			this.eventCallbacks.delete(callback);
		};
	}

	// Subscribe to connection status changes
	onStatusChange(callback: StatusCallback): () => void {
		this.statusCallbacks.add(callback);
		return () => {
			this.statusCallbacks.delete(callback);
		};
	}

	// Mark notification as read
	markAsRead(id: string) {
		this.notifications = this.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
		this.saveToStorage();
	}

	// Mark all as read
	markAllAsRead(clusterId?: string) {
		this.notifications = this.notifications.map((n) =>
			!clusterId || n.clusterId === clusterId ? { ...n, read: true } : n
		);
		this.saveToStorage();
	}

	// Clear all notifications
	clearAll(clusterId?: string) {
		if (clusterId) {
			this.notifications = this.notifications.filter((n) => n.clusterId !== clusterId);
			// Purge per-cluster entries from lastNotificationState
			for (const key of this.lastNotificationState.keys()) {
				if (key.startsWith(`${clusterId}/`)) {
					this.lastNotificationState.delete(key);
				}
			}
		} else {
			this.notifications = [];
			this.lastNotificationState.clear();
		}
		this.saveToStorage();
	}

	// Remove a specific notification
	removeNotification(id: string) {
		this.notifications = this.notifications.filter((n) => n.id !== id);
		this.saveToStorage();
	}
}

// Singleton instance
export const eventsStore = new RealtimeStore();
