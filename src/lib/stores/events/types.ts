export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface NotificationState {
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

export type EventCallback = (event: ResourceEvent) => void;
export type StatusCallback = (status: ConnectionStatus) => void;
