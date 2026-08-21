import { describe, expect, test } from 'vitest';
import { getReferenceKeyAction } from '../lib/components/wizards/reference-keyboard.js';

describe('reference picker keyboard actions', () => {
	test('opens from the closed picker with navigation keys', () => {
		expect(getReferenceKeyAction('Enter', false, -1, 0)).toEqual({
			type: 'toggle',
			preventDefault: true
		});
		expect(getReferenceKeyAction('Escape', false, -1, 0)).toEqual({
			type: 'none',
			preventDefault: false
		});
	});

	test('wraps focus while the picker is open', () => {
		expect(getReferenceKeyAction('ArrowDown', true, 2, 3)).toEqual({
			type: 'move',
			index: 0,
			preventDefault: true
		});
		expect(getReferenceKeyAction('ArrowUp', true, 0, 3)).toEqual({
			type: 'move',
			index: 2,
			preventDefault: true
		});
	});

	test('selects valid focus and closes without swallowing Tab', () => {
		expect(getReferenceKeyAction('Enter', true, 1, 3)).toEqual({
			type: 'select',
			index: 1,
			preventDefault: true
		});
		expect(getReferenceKeyAction('Tab', true, 1, 3)).toEqual({
			type: 'close',
			preventDefault: false
		});
	});
});
