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
		events: ['success', 'failure', 'warning', 'info', 'error']
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
			// If no prefs provided, reset to defaults
			if (!prefs) {
				_notifications = {
					enabled: true,
					resourceTypes: [],
					namespaces: [],
					events: ['success', 'failure', 'warning', 'info', 'error']
				};
				return;
			}
			// Merge with defaults to ensure we don't have partial state issues
			_notifications = {
				enabled: prefs.enabled ?? true,
				resourceTypes: prefs.resourceTypes ?? [],
				namespaces: prefs.namespaces ?? [],
				events: prefs.events ?? ['success', 'failure', 'warning', 'info', 'error']
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
			// We support 'success', 'failure', 'warning', 'info', and 'error'
			// Map 'error' to 'failure' for check if needed, but since we added 'error' to union we can just check directly
			if (_notifications.events && !_notifications.events.includes(type as any)) {
				// Also check 'failure' if type is 'error' for backwards compatibility/aliasing in UI
				if (type === 'error' && _notifications.events.includes('failure')) {
					return true;
				}
				return false;
			}

			return true;
		}
	};
}

export const preferences = createPreferencesStore();
