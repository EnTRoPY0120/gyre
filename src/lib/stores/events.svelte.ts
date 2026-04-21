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

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface NotificationState {
	revision: string | undefined;
	readyStatus: string | undefined;
	readyReason: string | undefined;
	messagePreview: string;
}

export interface ResourceEvent {
	type: 'ADDED' | 'MODIFIED' | 'DELETED' | 'CONNECTED' | 'HEARTBEAT' | 'ERROR' | 'SHUTDOWN';
	clusterId?: string;
	resourceType?: string;
	serverSessionId?: string;
	reason?: string;
	resource?: {
		metadata: {
			name: string;
			namespace: string;
			uid: string;
		};
		status?: {
			conditions?: Array<{
				type: string;
				status: string;
				reason?: string;
				message?: string;
			}>;
		};
	};
	message?: string;
	timestamp: string;
}

export interface NotificationMessage {
	id: string;
	clusterId: string;
	type: 'info' | 'success' | 'warning' | 'error';
	title: string;
	message: string;
	resourceType?: string;
	resourceName?: string;
	resourceNamespace?: string;
	timestamp: Date;
	read: boolean;
}

type EventCallback = (event: ResourceEvent) => void;
type StatusCallback = (status: ConnectionStatus) => void;

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
				if (Array.isArray(parsed)) {
					// Legacy format: [[key, string], ...] — discard, will re-populate from events
					this.lastNotificationState = new Map();
				} else if (typeof parsed === 'object' && parsed !== null && Array.isArray(parsed.entries)) {
					// Current format: entries are NotificationState objects.
					// Validate present fields and normalize missing optional ones — JSON.stringify
					// drops undefined values so keys like revision/readyStatus/readyReason may be absent.
					const validEntries = (parsed.entries as unknown[]).flatMap<[string, NotificationState]>(
						(entry) => {
							if (
								!Array.isArray(entry) ||
								entry.length !== 2 ||
								typeof entry[0] !== 'string' ||
								typeof entry[1] !== 'object' ||
								entry[1] === null
							) {
								return [];
							}
							const raw = entry[1] as Record<string, unknown>;
							// Reject entries where a present field has an unexpected type
							if ('revision' in raw && typeof raw.revision !== 'string') return [];
							if ('readyStatus' in raw && typeof raw.readyStatus !== 'string') return [];
							if ('readyReason' in raw && typeof raw.readyReason !== 'string') return [];
							if ('messagePreview' in raw && typeof raw.messagePreview !== 'string') return [];
							return [
								[
									entry[0],
									{
										revision: typeof raw.revision === 'string' ? raw.revision : undefined,
										readyStatus: typeof raw.readyStatus === 'string' ? raw.readyStatus : undefined,
										readyReason: typeof raw.readyReason === 'string' ? raw.readyReason : undefined,
										messagePreview: typeof raw.messagePreview === 'string' ? raw.messagePreview : ''
									}
								]
							];
						}
					);
					this.lastNotificationState = new Map(validEntries);
					if (parsed.sessionId) {
						this.lastServerSessionId = parsed.sessionId;
					}
				}
				// else: unrecognised format — leave lastNotificationState as empty Map
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

	private handleMessage(data: ResourceEvent) {
		if (data.type === 'SHUTDOWN') {
			const permanent = data.reason === 'server_shutdown';
			logger.info(
				`[SSE] Received SHUTDOWN event from server (reason: ${data.reason || 'unknown'}), disconnecting and ${
					permanent ? 'preventing' : 'allowing'
				} reconnects.`
			);
			this.isServerShutdown = permanent;
			this.disconnect();
			if (!permanent) {
				this.scheduleReconnect();
			}
			return;
		}

		if (data.type === 'HEARTBEAT') {
			return;
		}

		if (data.type === 'CONNECTED') {
			if (
				data.serverSessionId &&
				this.lastServerSessionId !== null &&
				this.lastServerSessionId !== data.serverSessionId
			) {
				logger.info('[SSE] Server session changed, clearing local notification state');
				this.lastNotificationState.clear();
			}
			if (data.serverSessionId) {
				this.lastServerSessionId = data.serverSessionId;
				// Persist so page reloads can detect server restarts
				this.saveToStorage();
			}
			return;
		}

		// Notify all event subscribers
		this.eventCallbacks.forEach((callback) => {
			try {
				callback(data);
			} catch (err) {
				logger.error(err, '[SSE] Error in event callback:');
			}
		});

		// Create notification for resource events
		if (data.resource) {
			this.addNotification(data);
		}
	}

	private addNotification(event: ResourceEvent) {
		if (!event.resource || !event.resourceType) return;

		// Check preferences before processing
		const type = this.getNotificationType(event);
		const namespace = event.resource.metadata.namespace;

		if (!preferences.shouldShowNotification(event.resourceType, namespace, type)) {
			return;
		}

		const clusterId = event.clusterId || IN_CLUSTER_ID;
		const resourceKey = `${clusterId}/${event.resourceType}/${event.resource.metadata.namespace}/${event.resource.metadata.name}`;
		const readyCondition = event.resource.status?.conditions?.find((c) => c.type === 'Ready');

		// Build a state signature matching server-side logic
		// Focus on actual meaningful changes: revision/SHA, ready state, and message preview
		const revision = this.getRevisionFromResource(event.resource);
		const messagePreview = readyCondition?.message?.substring(0, MESSAGE_PREVIEW_LENGTH) || '';

		// Match the server-side notificationState structure exactly (no extra fields)
		const currentStateObj: NotificationState = {
			revision,
			readyStatus: readyCondition?.status,
			readyReason: readyCondition?.reason,
			messagePreview
		};

		const previousState = this.lastNotificationState.get(resourceKey);

		// Skip notification if this exact state was already notified
		// Exception: Always notify ADDED and DELETED events
		if (
			event.type === 'MODIFIED' &&
			JSON.stringify(currentStateObj) === JSON.stringify(previousState)
		) {
			// This is a duplicate notification - same resource in same state
			logger.debug(
				`[Notification] Skipping duplicate for ${resourceKey}: state unchanged (revision: ${revision || 'none'})`
			);
			return;
		}

		// Update the state cache (will be persisted with notification)
		this.lastNotificationState.set(resourceKey, currentStateObj);

		// Log state change for debugging
		if (previousState) {
			logger.debug(
				`[Notification] State change for ${resourceKey}: revision "${previousState.revision || 'none'}" -> "${revision || 'none'}", ready: ${currentStateObj.readyStatus}`
			);
		} else {
			logger.debug(
				`[Notification] New notification for ${resourceKey}: ${event.type}, revision: ${revision || 'none'}`
			);
		}

		const notification: NotificationMessage = {
			id: crypto.randomUUID(),
			clusterId,
			type: this.getNotificationType(event),
			title: this.getNotificationTitle(event),
			message: this.getNotificationMessage(event),
			resourceType: event.resourceType,
			resourceName: event.resource.metadata.name,
			resourceNamespace: event.resource.metadata.namespace,
			timestamp: new Date(),
			read: false
		};

		// Add to beginning of array and limit total notifications.
		// The higher limit accommodates events from multiple clusters sharing one store.
		this.notifications = [notification, ...this.notifications.slice(0, MAX_NOTIFICATIONS - 1)];

		// Persist to localStorage
		this.saveToStorage();
	}

	private getNotificationType(event: ResourceEvent): NotificationMessage['type'] {
		if (event.type === 'ERROR') return 'error';
		if (event.type === 'DELETED') return 'warning';

		// Check if resource has failed conditions
		const readyCondition = event.resource?.status?.conditions?.find((c) => c.type === 'Ready');
		if (readyCondition?.status === 'False') return 'warning';

		if (event.type === 'ADDED') return 'success';
		return 'info';
	}

	private getNotificationTitle(event: ResourceEvent): string {
		switch (event.type) {
			case 'ADDED':
				return `${event.resourceType} Created`;
			case 'MODIFIED':
				return `${event.resourceType} Updated`;
			case 'DELETED':
				return `${event.resourceType} Deleted`;
			case 'ERROR':
				return `${event.resourceType} Error`;
			default:
				return `${event.resourceType} Event`;
		}
	}

	private getNotificationMessage(event: ResourceEvent): string {
		if (!event.resource) return event.message || 'Unknown event';

		const name = event.resource.metadata.name;
		const namespace = event.resource.metadata.namespace;
		const readyCondition = event.resource.status?.conditions?.find((c) => c.type === 'Ready');

		if (readyCondition?.message) {
			return `${name} in ${namespace}: ${readyCondition.message}`;
		}

		return `${name} in ${namespace}`;
	}

	private getRevisionFromResource(resource: ResourceEvent['resource']): string | undefined {
		if (!resource) return undefined;
		const status = resource.status as Record<string, unknown> | undefined;
		if (!status) return undefined;
		return (
			(status.lastAppliedRevision as string) ||
			((status.artifact as Record<string, unknown>)?.revision as string) ||
			(status.lastAttemptedRevision as string)
		);
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

// Legacy alias for backwards compatibility
export type WebSocketStatus = ConnectionStatus;
