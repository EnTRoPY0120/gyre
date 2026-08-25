import { describe, test, expect } from 'vitest';
import { commandPaletteOpen } from '../lib/stores/commandPalette.js';
import { highlightText } from '../lib/components/command-palette-highlighting.js';
import { buildCommandItems, getResourceIcon } from '../lib/components/command-palette-items.js';
import { getCommandPaletteKeyAction } from '../lib/components/command-palette-keyboard.js';
import { resourceGroups } from '../lib/config/resources.js';

// Helper: read current store value synchronously via subscribe
function getValue(): boolean {
	let current = false;
	const unsub = commandPaletteOpen.subscribe((v) => {
		current = v;
	});
	unsub();
	return current;
}

describe('commandPaletteOpen store', () => {
	test('initial state is false (closed)', () => {
		expect(getValue()).toBe(false);
	});

	test('open() sets state to true', () => {
		commandPaletteOpen.close(); // reset
		commandPaletteOpen.open();
		expect(getValue()).toBe(true);
	});

	test('close() sets state to false', () => {
		commandPaletteOpen.open();
		commandPaletteOpen.close();
		expect(getValue()).toBe(false);
	});

	test('toggle() flips state from false to true', () => {
		commandPaletteOpen.close();
		commandPaletteOpen.toggle();
		expect(getValue()).toBe(true);
	});

	test('toggle() flips state from true to false', () => {
		commandPaletteOpen.open();
		commandPaletteOpen.toggle();
		expect(getValue()).toBe(false);
	});

	test('toggle() called twice returns to original state', () => {
		commandPaletteOpen.close();
		commandPaletteOpen.toggle();
		commandPaletteOpen.toggle();
		expect(getValue()).toBe(false);
	});

	test('subscribe() receives updates synchronously', () => {
		const received: boolean[] = [];
		const unsub = commandPaletteOpen.subscribe((v) => received.push(v));

		commandPaletteOpen.close();
		commandPaletteOpen.open();
		commandPaletteOpen.close();
		unsub();

		// First value is the initial emit on subscribe, then the changes
		expect(received).toContain(true);
		expect(received).toContain(false);
	});

	test('unsubscribed listener no longer receives updates', () => {
		const received: boolean[] = [];
		const unsub = commandPaletteOpen.subscribe((v) => received.push(v));
		unsub();

		const countBefore = received.length;
		commandPaletteOpen.open();
		commandPaletteOpen.close();

		expect(received.length).toBe(countBefore);
	});
});

describe('highlightText', () => {
	test('preserves unmatched text around ordered highlight ranges', () => {
		expect(
			highlightText('Kustomization', [
				[0, 2],
				[5, 7]
			])
		).toEqual([
			{ text: 'Kus', highlighted: true },
			{ text: 'to', highlighted: false },
			{ text: 'miz', highlighted: true },
			{ text: 'ation', highlighted: false }
		]);
	});

	test('returns one unhighlighted segment when there are no ranges', () => {
		expect(highlightText('Dashboard')).toEqual([{ text: 'Dashboard', highlighted: false }]);
	});
});

describe('command palette items', () => {
	test('includes creation and resource search metadata for editors', () => {
		const items = buildCommandItems(resourceGroups, { isAdmin: false, canCreate: true });

		expect(items.find((item) => item.id === 'nav-create')).toMatchObject({
			href: '/create',
			keywords: ['new', 'add']
		});
		expect(items.find((item) => item.id === 'resource-kustomizations')).toMatchObject({
			category: 'Resources',
			keywords: ['Kustomize', 'Kustomization']
		});
		expect(items.some((item) => item.category === 'Admin')).toBe(false);
	});

	test('adds the complete admin navigation only for admins', () => {
		const items = buildCommandItems(resourceGroups, { isAdmin: true, canCreate: true });
		const adminItems = items.filter((item) => item.category === 'Admin');

		expect(adminItems.map((item) => item.id)).toEqual([
			'admin-users',
			'admin-clusters',
			'admin-auth-providers',
			'admin-settings',
			'admin-policies'
		]);
	});

	test('omits creation for viewers and falls back for unknown resource icons', () => {
		const items = buildCommandItems(resourceGroups, { isAdmin: false, canCreate: false });

		expect(items.some((item) => item.id === 'nav-create')).toBe(false);
		expect(getResourceIcon('unknown')).toBe('file');
	});
});

describe('command palette keyboard actions', () => {
	test('clamps navigation at both list boundaries', () => {
		expect(getCommandPaletteKeyAction('ArrowDown', 0, 3)).toEqual({
			type: 'move',
			index: 1,
			preventDefault: true
		});
		expect(getCommandPaletteKeyAction('ArrowDown', 2, 3)).toEqual({
			type: 'move',
			index: 2,
			preventDefault: true
		});
		expect(getCommandPaletteKeyAction('ArrowUp', 0, 3)).toEqual({
			type: 'move',
			index: 0,
			preventDefault: true
		});
	});

	test('selects on Enter and ignores unrelated keys', () => {
		expect(getCommandPaletteKeyAction('Enter', 1, 3)).toEqual({
			type: 'select',
			preventDefault: true
		});
		expect(getCommandPaletteKeyAction('Escape', 1, 3)).toEqual({
			type: 'none',
			preventDefault: false
		});
	});
});
