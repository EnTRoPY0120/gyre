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
	type NotificationCandidate,
	type EventControlAction,
	type NotificationState
} from './events/helpers.js';
import { createEventSource } from './events/connection.js';
import { loadNotificationStorage, saveNotificationStorage } from './events/storage.js';

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
		const restored = loadNotificationStorage(localStorage, keys, logger);
		this.notifications = restored.notifications;
		this.lastNotificationState = new Map(restored.state.entries);
		if (restored.state.sessionId) this.lastServerSessionId = restored.state.sessionId;
	}

	private saveToStorage() {
		if (typeof window === 'undefined') return;

		saveNotificationStorage({
			storage: localStorage,
			keys: this.getStorageKeys(),
			notifications: this.notifications,
			state: this.lastNotificationState,
			sessionId: this.lastServerSessionId,
			logger,
			maxNotifications: MAX_NOTIFICATIONS
		});
	}

	private canReconnectAfterServerShutdown(): boolean {
		if (!this.isServerShutdown) return true;
		if (import.meta.env.DEV) {
			this.isServerShutdown = false;
			return true;
		}
		return false;
	}

	private handleConnectionFailure(error: unknown) {
		logger.error(error, '[SSE] Failed to connect:');
		this.status = 'error';
		this.notifyStatusChange('error');
		this.scheduleReconnect();
	}

	private canStartConnection(): boolean {
		if (!this.canReconnectAfterServerShutdown()) return false;

		if (this.eventSource?.readyState === EventSource.OPEN) {
			return false;
		}

		// Only connect in browser environment
		return typeof window !== 'undefined';
	}

	private createEventStream(): EventSource {
		return createEventSource('/api/v1/events', {
			onOpen: (source) => this.handleSseOpen(source),
			onMessage: (source, event) => this.handleSseMessage(source, event),
			onError: (source) => this.handleSseError(source)
		});
	}

	connect() {
		if (!this.canStartConnection()) return;

		this.status = 'connecting';
		this.notifyStatusChange('connecting');

		try {
			this.eventSource = this.createEventStream();
		} catch (err) {
			this.handleConnectionFailure(err);
		}
	}

	private handleSseOpen(source: EventSource) {
		if (this.eventSource !== source) return;
		this.status = 'connected';
		this.reconnectAttempts = 0;
		this.notifyStatusChange('connected');
		logger.info('[SSE] Connected to event stream');
	}

	private handleSseMessage(source: EventSource, event: MessageEvent) {
		if (this.eventSource !== source) return;
		try {
			const data: ResourceEvent = JSON.parse(event.data);
			this.handleMessage(data);
		} catch (err) {
			logger.error(err, '[SSE] Failed to parse message:');
		}
	}

	private handleSseError(source: EventSource) {
		if (this.eventSource !== source) return;
		if (source.readyState === EventSource.CLOSED) {
			logger.info('[SSE] Connection closed');
			this.status = 'disconnected';
			this.notifyStatusChange('disconnected');
		} else {
			logger.warn('[SSE] Connection error');
			this.status = 'error';
			this.notifyStatusChange('error');
		}
		source.close();
		this.eventSource = null;
		this.scheduleReconnect();
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
		if (!this.canReconnectAfterServerShutdown()) return;

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
		this.logNotificationStateChange(event, candidate);
		this.storeNotification(event, candidate);
	}

	private logNotificationStateChange(event: ResourceEvent, candidate: NotificationCandidate) {
		if (candidate.previousState) {
			logger.debug(
				`[Notification] State change for ${candidate.resourceKey}: revision "${candidate.previousState.revision || 'none'}" -> "${candidate.currentState.revision || 'none'}", ready: ${candidate.currentState.readyStatus}`
			);
		} else {
			logger.debug(
				`[Notification] New notification for ${candidate.resourceKey}: ${event.type}, revision: ${candidate.currentState.revision || 'none'}`
			);
		}
	}

	private storeNotification(event: ResourceEvent, candidate: NotificationCandidate) {
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
