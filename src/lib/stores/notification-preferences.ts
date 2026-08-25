import type { UserPreferences } from '$lib/types/user';

export type NotificationPreferences = NonNullable<UserPreferences['notifications']>;
export type NormalizedNotificationPreferences = Required<NotificationPreferences>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NormalizedNotificationPreferences = {
	enabled: true,
	resourceTypes: [],
	namespaces: [],
	events: ['success', 'failure', 'warning', 'info', 'error']
};

export function normalizeNotificationPreferences(
	prefs: UserPreferences['notifications']
): NormalizedNotificationPreferences {
	return {
		enabled: prefs?.enabled ?? true,
		resourceTypes: prefs?.resourceTypes ?? [],
		namespaces: prefs?.namespaces ?? [],
		events: prefs?.events ?? DEFAULT_NOTIFICATION_PREFERENCES.events
	};
}

/** Decide whether a resource event is allowed by the user's notification filters. */
export function shouldShowNotification(
	prefs: NotificationPreferences,
	resourceType: string,
	namespace: string,
	type: string
): boolean {
	if (prefs.enabled === false) return false;

	if (prefs.resourceTypes?.length && !prefs.resourceTypes.includes(resourceType)) {
		return false;
	}

	if (prefs.namespaces?.length && !prefs.namespaces.includes(namespace)) {
		return false;
	}

	if (prefs.events && !prefs.events.includes(type as (typeof prefs.events)[number])) {
		return type === 'error' && prefs.events.includes('failure');
	}

	return true;
}
