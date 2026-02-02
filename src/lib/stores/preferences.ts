import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { ViewPreferences } from '$lib/types/view';

const DEFAULT_PREFERENCES: ViewPreferences = {
	viewMode: 'table',
	showNamespace: true,
	compactMode: false,
	autoRefresh: false,
	refreshInterval: 30
};

function createPreferencesStore() {
	// Load from localStorage if in browser
	const stored = browser ? localStorage.getItem('gyre:preferences') : null;
	const initial = stored ? { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) } : DEFAULT_PREFERENCES;

	const { subscribe, set, update } = writable<ViewPreferences>(initial);

	return {
		subscribe,
		set: (value: ViewPreferences) => {
			if (browser) {
				localStorage.setItem('gyre:preferences', JSON.stringify(value));
			}
			set(value);
		},
		update: (fn: (value: ViewPreferences) => ViewPreferences) => {
			update((current) => {
				const newValue = fn(current);
				if (browser) {
					localStorage.setItem('gyre:preferences', JSON.stringify(newValue));
				}
				return newValue;
			});
		},
		setViewMode: (viewMode: 'table' | 'grid') => {
			update((prefs) => {
				const newPrefs = { ...prefs, viewMode };
				if (browser) {
					localStorage.setItem('gyre:preferences', JSON.stringify(newPrefs));
				}
				return newPrefs;
			});
		},
		toggleNamespace: () => {
			update((prefs) => {
				const newPrefs = { ...prefs, showNamespace: !prefs.showNamespace };
				if (browser) {
					localStorage.setItem('gyre:preferences', JSON.stringify(newPrefs));
				}
				return newPrefs;
			});
		},
		toggleCompactMode: () => {
			update((prefs) => {
				const newPrefs = { ...prefs, compactMode: !prefs.compactMode };
				if (browser) {
					localStorage.setItem('gyre:preferences', JSON.stringify(newPrefs));
				}
				return newPrefs;
			});
		},
		toggleAutoRefresh: () => {
			update((prefs) => {
				const newPrefs = { ...prefs, autoRefresh: !prefs.autoRefresh };
				if (browser) {
					localStorage.setItem('gyre:preferences', JSON.stringify(newPrefs));
				}
				return newPrefs;
			});
		},
		setRefreshInterval: (interval: number) => {
			update((prefs) => {
				const newPrefs = { ...prefs, refreshInterval: Math.max(5, Math.min(300, interval)) };
				if (browser) {
					localStorage.setItem('gyre:preferences', JSON.stringify(newPrefs));
				}
				return newPrefs;
			});
		},
		reset: () => {
			if (browser) {
				localStorage.removeItem('gyre:preferences');
			}
			set(DEFAULT_PREFERENCES);
		}
	};
}

export const preferences = createPreferencesStore();
