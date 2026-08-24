import { describe, expect, test } from 'vitest';
import { getInitialFocusTarget, makeLabelledElementFocusable } from '../lib/utils/focus-trap.js';

function element(overrides: Partial<HTMLElement> = {}): HTMLElement {
	return {
		hasAttribute: () => false,
		getAttribute: () => null,
		tabIndex: 0,
		...overrides
	} as HTMLElement;
}

describe('focus trap target helpers', () => {
	test('prefers the explicit initial-focus selector', () => {
		const target = element();
		const node = element({
			getAttribute: (name) => (name === 'data-initial-focus' ? '[data-primary]' : null),
			querySelector: () => target
		});

		expect(getInitialFocusTarget(node, null)).toBe(target);
	});

	test('falls back through focusable elements, label, and container', () => {
		const focusable = element();
		const labelled = element();
		const node = element({ querySelectorAll: () => [focusable] });

		expect(getInitialFocusTarget(node, labelled)).toBe(focusable);
		expect(getInitialFocusTarget(element({ querySelectorAll: () => [] }), labelled)).toBe(labelled);
		expect(getInitialFocusTarget(element({ querySelectorAll: () => [] }), null)).not.toBeNull();
	});

	test('makes a labelled fallback focusable only when needed', () => {
		const labelled = element({ hasAttribute: () => false });
		makeLabelledElementFocusable(labelled, labelled);
		expect(labelled.tabIndex).toBe(-1);

		const alreadyFocusable = element({ hasAttribute: () => true, tabIndex: 2 });
		makeLabelledElementFocusable(alreadyFocusable, alreadyFocusable);
		expect(alreadyFocusable.tabIndex).toBe(2);
	});
});
