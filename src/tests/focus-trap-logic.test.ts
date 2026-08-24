import { describe, expect, test } from 'vitest';
import { getFocusTrapAction } from '../lib/utils/focus-trap-logic.js';

describe('getFocusTrapAction', () => {
	test('wraps Tab navigation at both ends of a focus trap', () => {
		expect(getFocusTrapAction('Tab', 3, false, 2)).toBe('focus-first');
		expect(getFocusTrapAction('Tab', 3, true, 0)).toBe('focus-last');
	});

	test('focuses the container when a trap has no focusable children', () => {
		expect(getFocusTrapAction('Tab', 0, false, -1)).toBe('focus-container');
	});

	test('leaves unrelated keys and interior navigation alone', () => {
		expect(getFocusTrapAction('Escape', 3, false, 2)).toBe('ignore');
		expect(getFocusTrapAction('Tab', 3, false, 1)).toBe('ignore');
		expect(getFocusTrapAction('Tab', 3, true, 1)).toBe('ignore');
	});
});
