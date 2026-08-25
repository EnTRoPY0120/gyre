import { describe, expect, test } from 'vitest';
import { formatLastRefresh } from '../lib/utils/polling.svelte.js';

describe('formatLastRefresh', () => {
	test('handles missing and very recent refresh times', () => {
		const now = Date.now();

		expect(formatLastRefresh(null)).toBe('Never');
		expect(formatLastRefresh(new Date(now - 2_000))).toBe('Just now');
	});

	test('formats refreshes in seconds and minutes', () => {
		const now = Date.now();

		expect(formatLastRefresh(new Date(now - 30_000))).toBe('30s ago');
		expect(formatLastRefresh(new Date(now - 120_000))).toBe('2m ago');
	});

	test('uses a clock time for older refreshes', () => {
		const refreshTime = new Date(Date.now() - 2 * 60 * 60 * 1_000);

		expect(formatLastRefresh(refreshTime)).toBe(refreshTime.toLocaleTimeString());
	});
});
