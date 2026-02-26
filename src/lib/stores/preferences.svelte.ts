import { browser } from '$app/environment';
import type { UserPreferences } from '$lib/types/user';
import type { ViewPreferences } from '$lib/types/view';

type CodeFormat = 'yaml' | 'json';

const DEFAULT_VIEW_PREFERENCES: ViewPreferences = {
	viewMode: 'table',
	showNamespace: true,
	compactMode: false,
	autoRefresh: false,
	refreshInterval: 30,
	itemsPerPage: 10
};

function createPreferencesStore() {
	// --- View Preferences ---
	let _viewPrefs = $state<ViewPreferences>(
		(() => {
			if (browser) {
				const stored = localStorage.getItem('gyre:preferences');
				if (stored) {
					try {
						return { ...DEFAULT_VIEW_PREFERENCES, ...JSON.parse(stored) };
					} catch {
						// Fallback if parsing fails
					}
				}
			}
			return { ...DEFAULT_VIEW_PREFERENCES };
		})()
	);

	// --- Code Editor Format ---
	let _format = $state<CodeFormat>(
		(browser && (localStorage.getItem('gyre_code_format') as CodeFormat)) || 'yaml'
	);

	// --- Notifications ---
	let _notifications = $state<NonNullable<UserPreferences['notifications']>>({
		enabled: true,
		resourceTypes: [],
		namespaces: [],
		events: ['success', 'failure', 'warning', 'info', 'error']
	});

	// Helper to persist view preferences
	function saveViewPrefs() {
		if (browser) {
			localStorage.setItem('gyre:preferences', JSON.stringify(_viewPrefs));
		}
	}

	return {
		// --- View Preferences Getters ---
		get viewMode() {
			return _viewPrefs.viewMode;
		},
		get showNamespace() {
			return _viewPrefs.showNamespace;
		},
		get compactMode() {
			return _viewPrefs.compactMode;
		},
		get autoRefresh() {
			return _viewPrefs.autoRefresh;
		},
		get refreshInterval() {
			return _viewPrefs.refreshInterval;
		},
		get itemsPerPage() {
			return _viewPrefs.itemsPerPage;
		},

		// --- View Preferences Actions ---
		setViewMode(viewMode: 'table' | 'grid') {
			_viewPrefs.viewMode = viewMode;
			saveViewPrefs();
		},
		toggleNamespace() {
			_viewPrefs.showNamespace = !_viewPrefs.showNamespace;
			saveViewPrefs();
		},
		toggleCompactMode() {
			_viewPrefs.compactMode = !_viewPrefs.compactMode;
			saveViewPrefs();
		},
		toggleAutoRefresh() {
			_viewPrefs.autoRefresh = !_viewPrefs.autoRefresh;
			saveViewPrefs();
		},
		setRefreshInterval(interval: number) {
			_viewPrefs.refreshInterval = Math.max(5, Math.min(300, interval));
			saveViewPrefs();
		},
		setItemsPerPage(count: number) {
			if (count !== 0 && count !== 10 && count !== 25 && count !== 50) return;
			_viewPrefs.itemsPerPage = count;
			saveViewPrefs();
		},
		resetViewPrefs() {
			_viewPrefs = { ...DEFAULT_VIEW_PREFERENCES };
			if (browser) {
				localStorage.removeItem('gyre:preferences');
			}
		},

		// --- Code Format Getters / Actions ---
		get format() {
			return _format;
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

		// --- Notifications Getters / Actions ---
		get notifications() {
			return _notifications;
		},
		setNotifications(prefs: UserPreferences['notifications']) {
			if (!prefs) {
				_notifications = {
					enabled: true,
					resourceTypes: [],
					namespaces: [],
					events: ['success', 'failure', 'warning', 'info', 'error']
				};
				return;
			}
			_notifications = {
				enabled: prefs.enabled ?? true,
				resourceTypes: prefs.resourceTypes ?? [],
				namespaces: prefs.namespaces ?? [],
				events: prefs.events ?? ['success', 'failure', 'warning', 'info', 'error']
			};
		},
		shouldShowNotification(resourceType: string, namespace: string, type: string): boolean {
			if (!_notifications.enabled) return false;

			if (
				_notifications.resourceTypes &&
				_notifications.resourceTypes.length > 0 &&
				!_notifications.resourceTypes.includes(resourceType)
			) {
				return false;
			}

			if (
				_notifications.namespaces &&
				_notifications.namespaces.length > 0 &&
				!_notifications.namespaces.includes(namespace)
			) {
				return false;
			}

			if (_notifications.events && !_notifications.events.includes(type as any)) {
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
