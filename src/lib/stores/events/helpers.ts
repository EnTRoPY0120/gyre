import type { NotificationMessage, ResourceEvent } from './types.js';

export interface NotificationState {
	revision: string | undefined;
	readyStatus: string | undefined;
	readyReason: string | undefined;
	messagePreview: string;
}

export interface NotificationCandidate {
	clusterId: string;
	resourceKey: string;
	type: NotificationMessage['type'];
	currentState: NotificationState;
	previousState: NotificationState | undefined;
	isDuplicate: boolean;
}

export interface StoredNotificationState {
	entries: Array<[string, NotificationState]>;
	sessionId?: string;
}

export type EventControlAction =
	| { type: 'shutdown'; permanent: boolean }
	| { type: 'heartbeat' }
	| { type: 'connected'; sessionChanged: boolean; sessionId?: string }
	| null;

export function getEventControlAction(
	event: ResourceEvent,
	lastServerSessionId: string | null
): EventControlAction {
	if (event.type === 'SHUTDOWN') {
		return { type: 'shutdown', permanent: event.reason === 'server_shutdown' };
	}
	if (event.type === 'HEARTBEAT') return { type: 'heartbeat' };
	if (event.type !== 'CONNECTED') return null;

	return {
		type: 'connected',
		sessionChanged:
			Boolean(event.serverSessionId) &&
			lastServerSessionId !== null &&
			event.serverSessionId !== lastServerSessionId,
		sessionId: event.serverSessionId
	};
}

export function parseStoredNotificationState(value: unknown): StoredNotificationState {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return { entries: [] };
	}

	const rawState = value as { entries?: unknown; sessionId?: unknown };
	if (!Array.isArray(rawState.entries)) return { entries: [] };

	const entries = rawState.entries.flatMap<[string, NotificationState]>((entry) => {
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
	});

	return {
		entries,
		sessionId: typeof rawState.sessionId === 'string' ? rawState.sessionId : undefined
	};
}

export function getNotificationType(event: ResourceEvent): NotificationMessage['type'] {
	if (event.type === 'ERROR') return 'error';
	if (event.type === 'DELETED') return 'warning';

	const readyCondition = event.resource?.status?.conditions?.find(
		(condition) => condition.type === 'Ready'
	);
	if (readyCondition?.status === 'False') return 'warning';
	if (event.type === 'ADDED') return 'success';
	return 'info';
}

export function getNotificationTitle(event: ResourceEvent): string {
	const titles: Partial<Record<ResourceEvent['type'], string>> = {
		ADDED: 'Created',
		MODIFIED: 'Updated',
		DELETED: 'Deleted',
		ERROR: 'Error'
	};
	return `${event.resourceType} ${titles[event.type] ?? 'Event'}`;
}

export function getNotificationMessage(event: ResourceEvent): string {
	if (!event.resource) return event.message || 'Unknown event';

	const { name, namespace } = event.resource.metadata;
	const readyCondition = event.resource.status?.conditions?.find(
		(condition) => condition.type === 'Ready'
	);
	return readyCondition?.message
		? `${name} in ${namespace}: ${readyCondition.message}`
		: `${name} in ${namespace}`;
}

export function getRevisionFromResource(resource: ResourceEvent['resource']): string | undefined {
	if (!resource?.status) return undefined;
	const status = resource.status as Record<string, unknown>;
	return (
		(status.lastAppliedRevision as string) ||
		((status.artifact as Record<string, unknown>)?.revision as string) ||
		(status.lastAttemptedRevision as string)
	);
}

export function getNotificationState(
	event: ResourceEvent,
	messagePreviewLength: number
): NotificationState {
	const readyCondition = event.resource?.status?.conditions?.find(
		(condition) => condition.type === 'Ready'
	);
	return {
		revision: getRevisionFromResource(event.resource),
		readyStatus: readyCondition?.status,
		readyReason: readyCondition?.reason,
		messagePreview: readyCondition?.message?.substring(0, messagePreviewLength) || ''
	};
}

export function getNotificationKey(event: ResourceEvent, clusterId: string): string | undefined {
	if (!event.resource || !event.resourceType) return undefined;
	return `${clusterId}/${event.resourceType}/${event.resource.metadata.namespace}/${event.resource.metadata.name}`;
}

export function isDuplicateNotification(
	event: ResourceEvent,
	currentState: NotificationState,
	previousState: NotificationState | undefined
): boolean {
	return (
		event.type === 'MODIFIED' && JSON.stringify(currentState) === JSON.stringify(previousState)
	);
}

/** Prepare notification identity and state without mutating the store or storage. */
export function prepareNotification(
	event: ResourceEvent,
	previousStates: Map<string, NotificationState>,
	shouldShowNotification: (
		resourceType: string,
		namespace: string,
		type: NotificationMessage['type']
	) => boolean,
	messagePreviewLength: number,
	defaultClusterId: string
): NotificationCandidate | null {
	if (!event.resource || !event.resourceType) return null;

	const type = getNotificationType(event);
	const namespace = event.resource.metadata.namespace;
	if (!shouldShowNotification(event.resourceType, namespace, type)) return null;

	const clusterId = event.clusterId || defaultClusterId;
	const resourceKey = getNotificationKey(event, clusterId);
	if (!resourceKey) return null;

	const currentState = getNotificationState(event, messagePreviewLength);
	const previousState = previousStates.get(resourceKey);
	return {
		clusterId,
		resourceKey,
		type,
		currentState,
		previousState,
		isDuplicate: isDuplicateNotification(event, currentState, previousState)
	};
}

export function getNotificationStateChangeMessage(
	event: ResourceEvent,
	candidate: NotificationCandidate
): string {
	if (candidate.previousState) {
		return `[Notification] State change for ${candidate.resourceKey}: revision "${candidate.previousState.revision || 'none'}" -> "${candidate.currentState.revision || 'none'}", ready: ${candidate.currentState.readyStatus}`;
	}

	return `[Notification] New notification for ${candidate.resourceKey}: ${event.type}, revision: ${candidate.currentState.revision || 'none'}`;
}

export function buildNotification(
	event: ResourceEvent,
	clusterId: string,
	type: NotificationMessage['type']
): NotificationMessage {
	return {
		id: crypto.randomUUID(),
		clusterId,
		type,
		title: getNotificationTitle(event),
		message: getNotificationMessage(event),
		resourceType: event.resourceType ?? '',
		resourceName: event.resource?.metadata.name ?? '',
		resourceNamespace: event.resource?.metadata.namespace,
		timestamp: new Date(),
		read: false
	};
}
