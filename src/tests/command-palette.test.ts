import { describe, test, expect } from 'vitest';
import { commandPaletteOpen } from '../lib/stores/commandPalette.js';

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
