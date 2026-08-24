import { describe, expect, test } from 'vitest';
import {
	getThemeButtonKeyAction,
	getThemeMenuItemKeyAction
} from '../lib/components/layout/theme-keyboard.js';

describe('theme keyboard actions', () => {
	test('opens, closes, and cycles the theme menu from the button', () => {
		expect(getThemeButtonKeyAction('Enter', false, -1, 3, 1)).toEqual({
			type: 'open',
			index: 1,
			preventDefault: true
		});
		expect(getThemeButtonKeyAction(' ', true, 1, 3, 1)).toEqual({
			type: 'close',
			preventDefault: true
		});
		expect(getThemeButtonKeyAction('ArrowUp', true, 0, 3, 1)).toMatchObject({
			type: 'move',
			index: 2
		});
	});

	test('maps menu item selection, movement, and close keys', () => {
		expect(getThemeMenuItemKeyAction('Enter', 3, 1)).toEqual({
			type: 'select',
			preventDefault: true
		});
		expect(getThemeMenuItemKeyAction('ArrowDown', 3, 2)).toMatchObject({ type: 'move', index: 0 });
		expect(getThemeMenuItemKeyAction('Tab', 3, 1)).toEqual({
			type: 'close',
			preventDefault: false
		});
	});
});
