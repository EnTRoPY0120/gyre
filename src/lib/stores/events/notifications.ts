import { MESSAGE_PREVIEW_LENGTH } from '$lib/config/constants';
import type { NotificationMessage, ResourceEvent } from './types.js';

export function getRevisionFromResource(resource: ResourceEvent['resource']): string | undefined {
	if (!resource) return undefined;
	const status = resource.status as Record<string, unknown> | undefined;
	if (!status) return undefined;
	return (
		(status.lastAppliedRevision as string) ||
		((status.artifact as Record<string, unknown>)?.revision as string) ||
		(status.lastAttemptedRevision as string)
	);
}

export function getMessagePreview(message?: string): string {
	return message?.substring(0, MESSAGE_PREVIEW_LENGTH) || '';
}

export function getNotificationType(event: ResourceEvent): NotificationMessage['type'] {
	if (event.type === 'ERROR') return 'error';
	if (event.type === 'DELETED') return 'warning';
	const readyCondition = event.resource?.status?.conditions?.find((c) => c.type === 'Ready');
	if (readyCondition?.status === 'False') return 'warning';
	if (event.type === 'ADDED') return 'success';
	return 'info';
}
