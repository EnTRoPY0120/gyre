import { browser } from '$app/environment';
import type { UserPreferences } from '$lib/types/user';
import type { ViewPreferences } from '$lib/types/view';
import { safeGetItem, safeSetItem, safeRemoveItem } from '$lib/utils/storage';

type CodeFormat = 'yaml' | 'json';

export const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 0] as const;
type ValidItemsPerPage = (typeof ITEMS_PER_PAGE_OPTIONS)[number];

const DEFAULT_VIEW_PREFERENCES: ViewPreferences = {
	viewMode: 'table',
	showNamespace: true,
	compactMode: false,
	autoRefresh: false,
	refreshInterval: 30,
	itemsPerPage: 10
};

function sanitizeViewPrefs(raw: unknown): ViewPreferences {
	const r = raw as Record<string, unknown>;
	return {
		viewMode:
			r.viewMode === 'table' || r.viewMode === 'grid'
				? r.viewMode
				: DEFAULT_VIEW_PREFERENCES.viewMode,
		showNamespace:
			typeof r.showNamespace === 'boolean'
				? r.showNamespace
				: DEFAULT_VIEW_PREFERENCES.showNamespace,
		compactMode:
			typeof r.compactMode === 'boolean' ? r.compactMode : DEFAULT_VIEW_PREFERENCES.compactMode,
		autoRefresh:
			typeof r.autoRefresh === 'boolean' ? r.autoRefresh : DEFAULT_VIEW_PREFERENCES.autoRefresh,
		refreshInterval:
			typeof r.refreshInterval === 'number'
				? Math.max(5, Math.min(300, r.refreshInterval))
				: DEFAULT_VIEW_PREFERENCES.refreshInterval,
		itemsPerPage: ITEMS_PER_PAGE_OPTIONS.includes(r.itemsPerPage as ValidItemsPerPage)
			? (r.itemsPerPage as number)
			: DEFAULT_VIEW_PREFERENCES.itemsPerPage
	};
}

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
		enabled: true,
		resourceTypes: [],
		namespaces: [],
		events: ['success', 'failure', 'warning', 'info', 'error']
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
