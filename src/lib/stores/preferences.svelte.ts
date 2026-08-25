import { browser } from '$app/environment';
import type { UserPreferences } from '$lib/types/user';
import type { ViewPreferences } from '$lib/types/view';
import { safeGetItem, safeSetItem, safeRemoveItem } from '$lib/utils/storage';
import {
	DEFAULT_NOTIFICATION_PREFERENCES,
	normalizeNotificationPreferences,
	shouldShowNotification
} from './notification-preferences';
import {
	DEFAULT_VIEW_PREFERENCES,
	ITEMS_PER_PAGE_OPTIONS,
	sanitizeViewPrefs
} from './view-preferences';

export { ITEMS_PER_PAGE_OPTIONS } from './view-preferences';

type CodeFormat = 'yaml' | 'json';
type ValidItemsPerPage = (typeof ITEMS_PER_PAGE_OPTIONS)[number];

function createPreferencesStore() {
	// --- View Preferences ---
	let _viewPrefs = $state<ViewPreferences>(
		(() => {
			if (browser) {
				const stored = safeGetItem('gyre:preferences');
				if (stored) {
					try {
						return sanitizeViewPrefs(JSON.parse(stored));
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
		(browser && (safeGetItem('gyre_code_format') as CodeFormat)) || 'yaml'
	);

	// --- Notifications ---
	let _notifications = $state<NonNullable<UserPreferences['notifications']>>({
		...DEFAULT_NOTIFICATION_PREFERENCES
	});

	// Helper to persist view preferences
	function saveViewPrefs() {
		if (browser) {
			safeSetItem('gyre:preferences', JSON.stringify(_viewPrefs));
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
			if (!ITEMS_PER_PAGE_OPTIONS.includes(count as ValidItemsPerPage)) return;
			_viewPrefs.itemsPerPage = count;
			saveViewPrefs();
		},
		resetViewPrefs() {
			_viewPrefs = { ...DEFAULT_VIEW_PREFERENCES };
			if (browser) {
				safeRemoveItem('gyre:preferences');
			}
		},

		// --- Code Format Getters / Actions ---
		get format() {
			return _format;
		},
		setFormat(newFormat: CodeFormat) {
			_format = newFormat;
			if (browser) {
				safeSetItem('gyre_code_format', newFormat);
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
			_notifications = normalizeNotificationPreferences(prefs);
		},
		shouldShowNotification(resourceType: string, namespace: string, type: string): boolean {
			return shouldShowNotification(_notifications, resourceType, namespace, type);
		}
	};
}

export const preferences = createPreferencesStore();
