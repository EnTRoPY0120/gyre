export function normalizeError(value: unknown): Error | { message: string; value: unknown } {
	if (value instanceof Error) return value;
	if (typeof value === 'string') return new Error(value);
	return { message: 'Non-Error rejection', value };
}

export interface SSEEvent {
	type: 'CONNECTED' | 'ADDED' | 'MODIFIED' | 'DELETED' | 'HEARTBEAT' | 'SHUTDOWN';
	clusterId?: string;
	resourceType?: string;
	resource?: unknown;
	message?: string;
	timestamp: string;
	serverSessionId?: string;
	reason?: string;
}

export type Subscriber = (event: SSEEvent) => void;

export interface ClusterContext {
	clusterId: string;
	subscribers: Set<Subscriber>;
	isActive: boolean;
	pollTimeout: NodeJS.Timeout | null;
	heartbeatInterval: NodeJS.Timeout | null;
	inflightPollPromise: Promise<void> | null;
	lastStates: Map<string, string>;
	lastNotificationStates: Map<string, string>;
	resourceFirstSeen: Map<string, number>;
}
