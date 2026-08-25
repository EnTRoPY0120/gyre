import { describe, expect, test } from 'vitest';
import {
	DEFAULT_VIEW_PREFERENCES,
	ITEMS_PER_PAGE_OPTIONS,
	sanitizeViewPrefs
} from '../lib/stores/view-preferences.js';

describe('sanitizeViewPrefs', () => {
	test('returns defaults for missing or malformed persisted values', () => {
		expect(sanitizeViewPrefs(null)).toEqual(DEFAULT_VIEW_PREFERENCES);
		expect(sanitizeViewPrefs({ viewMode: 'cards', showNamespace: 'yes' })).toEqual(
			DEFAULT_VIEW_PREFERENCES
		);
	});

	test('preserves valid values and clamps the refresh interval', () => {
		expect(
			sanitizeViewPrefs({
				viewMode: 'grid',
				showNamespace: false,
				compactMode: true,
				autoRefresh: true,
				refreshInterval: 120,
				itemsPerPage: 50
			})
		).toEqual({
			viewMode: 'grid',
			showNamespace: false,
			compactMode: true,
			autoRefresh: true,
			refreshInterval: 120,
			itemsPerPage: 50
		});
		expect(sanitizeViewPrefs({ refreshInterval: 1 }).refreshInterval).toBe(5);
		expect(sanitizeViewPrefs({ refreshInterval: 301 }).refreshInterval).toBe(300);
	});

	test('accepts only supported page sizes', () => {
		for (const itemsPerPage of ITEMS_PER_PAGE_OPTIONS) {
			expect(sanitizeViewPrefs({ itemsPerPage }).itemsPerPage).toBe(itemsPerPage);
		}
		expect(sanitizeViewPrefs({ itemsPerPage: 20 }).itemsPerPage).toBe(
			DEFAULT_VIEW_PREFERENCES.itemsPerPage
		);
	});
});
