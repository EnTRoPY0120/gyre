/**
 * Real-time notification store using Server-Sent Events (SSE)
 * Falls back to polling if SSE is not available
 */

import { preferences } from './preferences.svelte';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface ResourceEvent {
	type: 'ADDED' | 'MODIFIED' | 'DELETED' | 'CONNECTED' | 'HEARTBEAT' | 'ERROR';
	clusterId?: string;
	resourceType?: string;
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

const NOTIFICATIONS_STORAGE_KEY = 'gyre_notifications';
const NOTIFICATION_STATE_STORAGE_KEY = 'gyre_notification_state';

class RealtimeStore {
	private eventSource: EventSource | null = null;
	private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectDelay = 1000;
	private eventCallbacks: Set<EventCallback> = new Set();
	private statusCallbacks: Set<StatusCallback> = new Set();

	// Notification state cache to prevent duplicate notifications
	// Key: `${resourceType}/${namespace}/${name}`, Value: `${readyStatus}/${readyMessageHash}`
	private lastNotificationState: Map<string, string> = new Map();

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

	private loadFromStorage() {
		try {
			// Load notifications
			// We now support both the old global key and new per-cluster keys indirectly
			// For simplicity and backward compatibility, we'll load the main key
			// but future versions could migrate to a more granular approach if needed
			const storedNotifications = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
			if (storedNotifications) {
				const parsed = JSON.parse(storedNotifications);
				// Convert timestamp strings back to Date objects and ensure clusterId exists
				this.notifications = parsed.map((n: NotificationMessage) => ({
					...n,
					clusterId: n.clusterId || 'in-cluster',
					timestamp: new Date(n.timestamp)
				}));
			}

			// Load notification state cache
			const storedState = localStorage.getItem(NOTIFICATION_STATE_STORAGE_KEY);
			if (storedState) {
				const parsed = JSON.parse(storedState);
				this.lastNotificationState = new Map(parsed);
			}
		} catch (err) {
			console.error('[Storage] Failed to load persisted notifications:', err);
			// Clear corrupted data
			localStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
			localStorage.removeItem(NOTIFICATION_STATE_STORAGE_KEY);
		}
	}

	private saveToStorage() {
		if (typeof window === 'undefined') return;

		try {
			// Save only the most recent notifications to avoid localStorage quota issues.
			// We increase this to 500 to accommodate multiple clusters in the same storage.
			const MAX_GLOBAL_NOTIFICATIONS = 500;
			const toSave = this.notifications.slice(0, MAX_GLOBAL_NOTIFICATIONS);
			localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(toSave));

			// Save notification state cache
			const stateArray = Array.from(this.lastNotificationState.entries());
			localStorage.setItem(NOTIFICATION_STATE_STORAGE_KEY, JSON.stringify(stateArray));
		} catch (err) {
			console.error('[Storage] Failed to persist notifications:', err);
		}
	}

	connect() {
		if (this.eventSource?.readyState === EventSource.OPEN) {
			return;
		}

		// Only connect in browser environment
		if (typeof window === 'undefined') {
			return;
		}

		this.status = 'connecting';
		this.notifyStatusChange('connecting');

		const sseUrl = '/api/ws/events';

		try {
			this.eventSource = new EventSource(sseUrl);

			this.eventSource.onopen = () => {
				this.status = 'connected';
				this.reconnectAttempts = 0;
				this.notifyStatusChange('connected');
				console.log('[SSE] Connected to event stream');
			};

			this.eventSource.onmessage = (event) => {
				try {
					const data: ResourceEvent = JSON.parse(event.data);
					this.handleMessage(data);
				} catch (err) {
					console.error('[SSE] Failed to parse message:', err);
				}
			};

			this.eventSource.onerror = () => {
				console.error('[SSE] Connection error');
				this.status = 'error';
				this.notifyStatusChange('error');
				this.eventSource?.close();
				this.eventSource = null;
				this.scheduleReconnect();
			};
		} catch (err) {
			console.error('[SSE] Failed to connect:', err);
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

	private scheduleReconnect() {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			console.log('[SSE] Max reconnect attempts reached');
			return;
		}

		const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
		this.reconnectAttempts++;

		console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

		this.reconnectTimeout = setTimeout(() => {
			this.connect();
		}, delay);
	}

	private handleMessage(data: ResourceEvent) {
		// Skip heartbeat and connected messages for notifications
		if (data.type === 'HEARTBEAT' || data.type === 'CONNECTED') {
			return;
		}

		// Notify all event subscribers
		this.eventCallbacks.forEach((callback) => {
			try {
				callback(data);
			} catch (err) {
				console.error('[SSE] Error in event callback:', err);
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

		const clusterId = event.clusterId || 'in-cluster';
		const resourceKey = `${clusterId}/${event.resourceType}/${event.resource.metadata.namespace}/${event.resource.metadata.name}`;
		const readyCondition = event.resource.status?.conditions?.find((c) => c.type === 'Ready');

		// Build a state signature matching server-side logic
		// Focus on actual meaningful changes: revision/SHA, ready state, and message preview
		const revision = this.getRevisionFromResource(event.resource);
		const messagePreview = readyCondition?.message?.substring(0, 100) || '';

		// Match the server-side notificationState structure
		const currentState = JSON.stringify({
			type: event.type, // Include event type in client state
			revision: revision,
			readyStatus: readyCondition?.status,
			readyReason: readyCondition?.reason,
			messagePreview: messagePreview
		});

		const previousState = this.lastNotificationState.get(resourceKey);

		// Skip notification if this exact state was already notified
		// Exception: Always notify ADDED and DELETED events
		if (event.type === 'MODIFIED' && previousState === currentState) {
			// This is a duplicate notification - same resource in same state
			const parsedState = JSON.parse(currentState);
			console.log(
				`[Notification] Skipping duplicate for ${resourceKey}: state unchanged (revision: ${parsedState.revision || 'none'})`
			);
			return;
		}

		// Update the state cache (will be persisted with notification)
		this.lastNotificationState.set(resourceKey, currentState);

		// Log state change for debugging
		if (previousState) {
			const prevParsed = JSON.parse(previousState);
			const currParsed = JSON.parse(currentState);
			console.log(
				`[Notification] State change for ${resourceKey}: revision "${prevParsed.revision || 'none'}" -> "${currParsed.revision || 'none'}", ready: ${currParsed.readyStatus}`
			);
		} else {
			const currParsed = JSON.parse(currentState);
			console.log(
				`[Notification] New notification for ${resourceKey}: ${event.type}, revision: ${currParsed.revision || 'none'}`
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

		// Add to beginning of array and limit total notifications
		// We use a larger limit now that we have multiple clusters
		const MAX_GLOBAL_LIMIT = 500;
		this.notifications = [notification, ...this.notifications.slice(0, MAX_GLOBAL_LIMIT - 1)];

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
				console.error('[SSE] Error in status callback:', err);
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
export const websocketStore = new RealtimeStore();

// Legacy alias for backwards compatibility
export type WebSocketStatus = ConnectionStatus;
