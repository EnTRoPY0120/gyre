import { browser } from '$app/environment';
import type { UserPreferences } from '$lib/types/user';

type CodeFormat = 'yaml' | 'json';

function createPreferencesStore() {
	let _format = $state<CodeFormat>(
		(browser && (localStorage.getItem('gyre_code_format') as CodeFormat)) || 'yaml'
	);

	let _notifications = $state<NonNullable<UserPreferences['notifications']>>({
		enabled: true,
		resourceTypes: [],
		namespaces: [],
		events: ['success', 'failure', 'warning', 'info']
	});

	return {
		get format() {
			return _format;
		},
		get notifications() {
			return _notifications;
		},
		setFormat(newFormat: CodeFormat) {
			_format = newFormat;
			if (browser) {
				localStorage.setItem('gyre_code_format', newFormat);
			}
		},
		toggleFormat() {
			this.setFormat(_format === 'yaml' ? 'json' : 'yaml');
		},
		setNotifications(prefs: UserPreferences['notifications']) {
			if (!prefs) return;
			// Merge with defaults to ensure we don't have partial state issues
			_notifications = {
				enabled: prefs.enabled ?? true,
				resourceTypes: prefs.resourceTypes ?? [],
				namespaces: prefs.namespaces ?? [],
				events: prefs.events ?? ['success', 'failure', 'warning', 'info']
			};
		},
		shouldShowNotification(resourceType: string, namespace: string, type: string): boolean {
			if (!_notifications.enabled) return false;

			// Check resource type filter (empty = all)
			if (
				_notifications.resourceTypes &&
				_notifications.resourceTypes.length > 0 &&
				!_notifications.resourceTypes.includes(resourceType)
			) {
				return false;
			}

			// Check namespace filter (empty = all)
			if (
				_notifications.namespaces &&
				_notifications.namespaces.length > 0 &&
				!_notifications.namespaces.includes(namespace)
			) {
				return false;
			}

			// Check event type
			// internal types: 'info' | 'success' | 'warning' | 'error'
			// user types: 'success' | 'failure' | 'warning' | 'info'
			const checkType = type === 'error' ? 'failure' : type;

			if (_notifications.events && !_notifications.events.includes(checkType as any)) {
				return false;
			}

			return true;
		}
	};
}

export const preferences = createPreferencesStore();
