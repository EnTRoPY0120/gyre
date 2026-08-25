import type { ViewPreferences } from '$lib/types/view';

export const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 0] as const;
type ValidItemsPerPage = (typeof ITEMS_PER_PAGE_OPTIONS)[number];

export const DEFAULT_VIEW_PREFERENCES: ViewPreferences = {
	viewMode: 'table',
	showNamespace: true,
	compactMode: false,
	autoRefresh: false,
	refreshInterval: 30,
	itemsPerPage: 10
};

function asPreferencesRecord(raw: unknown): Record<string, unknown> {
	return raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

function parseViewMode(value: unknown): ViewPreferences['viewMode'] {
	return value === 'table' || value === 'grid' ? value : DEFAULT_VIEW_PREFERENCES.viewMode;
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function parseRefreshInterval(value: unknown): number {
	return typeof value === 'number'
		? Math.max(5, Math.min(300, value))
		: DEFAULT_VIEW_PREFERENCES.refreshInterval;
}

function parseItemsPerPage(value: unknown): number {
	return ITEMS_PER_PAGE_OPTIONS.includes(value as ValidItemsPerPage)
		? (value as number)
		: DEFAULT_VIEW_PREFERENCES.itemsPerPage;
}

/** Normalize persisted view preferences while applying safe UI bounds. */
export function sanitizeViewPrefs(raw: unknown): ViewPreferences {
	const preferences = asPreferencesRecord(raw);
	return {
		viewMode: parseViewMode(preferences.viewMode),
		showNamespace: parseBoolean(preferences.showNamespace, DEFAULT_VIEW_PREFERENCES.showNamespace),
		compactMode: parseBoolean(preferences.compactMode, DEFAULT_VIEW_PREFERENCES.compactMode),
		autoRefresh: parseBoolean(preferences.autoRefresh, DEFAULT_VIEW_PREFERENCES.autoRefresh),
		refreshInterval: parseRefreshInterval(preferences.refreshInterval),
		itemsPerPage: parseItemsPerPage(preferences.itemsPerPage)
	};
}
