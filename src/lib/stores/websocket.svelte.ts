/**
 * Real-time notification store using Server-Sent Events (SSE)
 * Falls back to polling if SSE is not available
 */

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface ResourceEvent {
	type: 'ADDED' | 'MODIFIED' | 'DELETED' | 'CONNECTED' | 'HEARTBEAT' | 'ERROR';
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
				message?: string;
			}>;
		};
	};
	message?: string;
	timestamp: string;
}

export interface NotificationMessage {
	id: string;
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

class RealtimeStore {
	private eventSource: EventSource | null = null;
	private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectDelay = 1000;
	private eventCallbacks: Set<EventCallback> = new Set();
	private statusCallbacks: Set<StatusCallback> = new Set();

	// Reactive state using Svelte 5 runes
	status = $state<ConnectionStatus>('disconnected');
	notifications = $state<NotificationMessage[]>([]);
	unreadCount = $derived(this.notifications.filter((n) => !n.read).length);

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

		const notification: NotificationMessage = {
			id: crypto.randomUUID(),
			type: this.getNotificationType(event),
			title: this.getNotificationTitle(event),
			message: this.getNotificationMessage(event),
			resourceType: event.resourceType,
			resourceName: event.resource.metadata.name,
			resourceNamespace: event.resource.metadata.namespace,
			timestamp: new Date(),
			read: false
		};

		// Add to beginning of array and limit to 50 notifications
		this.notifications = [notification, ...this.notifications.slice(0, 49)];
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
	}

	// Mark all as read
	markAllAsRead() {
		this.notifications = this.notifications.map((n) => ({ ...n, read: true }));
	}

	// Clear all notifications
	clearAll() {
		this.notifications = [];
	}

	// Remove a specific notification
	removeNotification(id: string) {
		this.notifications = this.notifications.filter((n) => n.id !== id);
	}
}

// Singleton instance
export const websocketStore = new RealtimeStore();

// Legacy alias for backwards compatibility
export type WebSocketStatus = ConnectionStatus;
