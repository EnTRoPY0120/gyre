import type { UserPreferences } from '$lib/types/user';

export type NotificationPreferences = NonNullable<UserPreferences['notifications']>;

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
