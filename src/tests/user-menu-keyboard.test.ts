import { describe, expect, test } from 'vitest';
import {
	applyUserMenuKeyAction,
	getUserMenuKeyAction
} from '../lib/components/layout/user-menu-keyboard.js';

describe('getUserMenuKeyAction', () => {
	test('cycles menu items in both directions', () => {
		expect(getUserMenuKeyAction('ArrowDown', true, 2, 3)).toEqual({ type: 'move', index: 0 });
		expect(getUserMenuKeyAction('ArrowUp', true, 0, 3)).toEqual({ type: 'move', index: 2 });
	});

	test('closes with the correct focus behavior', () => {
		expect(getUserMenuKeyAction('Escape', true, 0, 3)).toEqual({
			type: 'close',
			restoreFocus: true,
			preventDefault: true
		});
		expect(getUserMenuKeyAction('Tab', true, 0, 3)).toEqual({
			type: 'close',
			restoreFocus: false,
			preventDefault: false
		});
	});

	test('ignores keys while closed or unsupported keys', () => {
		expect(getUserMenuKeyAction('ArrowDown', false, 0, 3)).toEqual({ type: 'ignore' });
		expect(getUserMenuKeyAction('Home', true, 0, 3)).toEqual({ type: 'ignore' });
	});

	test('applies keyboard actions to menu callbacks', () => {
		const calls: string[] = [];
		const handlers = {
			preventDefault: () => calls.push('prevent'),
			move: (index: number) => calls.push(`move:${index}`),
			close: (restoreFocus: boolean) => calls.push(`close:${restoreFocus}`)
		};

		applyUserMenuKeyAction({ type: 'move', index: 2 }, handlers);
		applyUserMenuKeyAction({ type: 'close', restoreFocus: true, preventDefault: true }, handlers);
		applyUserMenuKeyAction({ type: 'ignore' }, handlers);

		expect(calls).toEqual(['prevent', 'move:2', 'prevent', 'close:true']);
	});
});
