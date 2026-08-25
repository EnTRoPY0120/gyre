import { describe, expect, test } from 'vitest';
import { getStoredThemeValue } from '../lib/stores/theme-storage.js';

describe('getStoredThemeValue', () => {
	test('accepts each supported theme', () => {
		expect(getStoredThemeValue('light')).toBe('light');
		expect(getStoredThemeValue('dark')).toBe('dark');
		expect(getStoredThemeValue('system')).toBe('system');
	});

	test('falls back to system for missing or invalid values', () => {
		expect(getStoredThemeValue(null)).toBe('system');
		expect(getStoredThemeValue(undefined)).toBe('system');
		expect(getStoredThemeValue('sepia')).toBe('system');
	});
});
