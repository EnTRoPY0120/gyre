import { describe, expect, test } from 'vitest';
import { getTabTargetIndex } from '../lib/components/resources/tab-keyboard.js';

describe('getTabTargetIndex', () => {
	test('wraps arrow navigation across the available tabs', () => {
		expect(getTabTargetIndex('ArrowRight', 2, 3)).toBe(0);
		expect(getTabTargetIndex('ArrowLeft', 0, 3)).toBe(2);
		expect(getTabTargetIndex('ArrowRight', 0, 3)).toBe(1);
	});

	test('jumps to the first and last tabs', () => {
		expect(getTabTargetIndex('Home', 1, 4)).toBe(0);
		expect(getTabTargetIndex('End', 1, 4)).toBe(3);
	});

	test('ignores keys that do not navigate tabs', () => {
		expect(getTabTargetIndex('Enter', 1, 4)).toBeNull();
		expect(getTabTargetIndex('Tab', 1, 4)).toBeNull();
	});
});
