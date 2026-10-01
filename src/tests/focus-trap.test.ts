import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { modalFocusTrap } from '../lib/utils/focus-trap.js';
import {
	getInitialFocusTarget,
	makeLabelledElementFocusable
} from '../lib/utils/focus-trap-dom.js';

let container: HTMLDivElement;

beforeEach(() => {
	document.body.replaceChildren();
	container = document.createElement('div');
	document.body.append(container);
});

afterEach(() => {
	document.body.replaceChildren();
	vi.useRealTimers();
});

describe('focus trap target helpers', () => {
	test('prefers the explicit initial-focus selector', () => {
		const initial = document.createElement('button');
		initial.dataset.primary = '';
		container.dataset.initialFocus = '[data-primary]';
		container.append(initial);

		expect(getInitialFocusTarget(container, null)).toBe(initial);
	});

	test('falls back through focusable elements, label, and container', () => {
		const focusable = document.createElement('button');
		const labelled = document.createElement('h2');
		container.append(focusable);

		expect(getInitialFocusTarget(container, labelled)).toBe(focusable);
		container.replaceChildren();
		expect(getInitialFocusTarget(container, labelled)).toBe(labelled);
		expect(getInitialFocusTarget(container, null)).toBe(container);
	});

	test('makes a labelled fallback focusable only when needed', () => {
		const labelled = document.createElement('h2');
		makeLabelledElementFocusable(labelled, labelled);
		expect(labelled.tabIndex).toBe(-1);

		labelled.tabIndex = 2;
		makeLabelledElementFocusable(labelled, labelled);
		expect(labelled.tabIndex).toBe(2);
	});
});

describe('modalFocusTrap', () => {
	test('wraps Tab navigation and restores focus when destroyed', () => {
		const previous = document.createElement('button');
		const first = document.createElement('button');
		const last = document.createElement('button');
		container.append(first, last);
		document.body.prepend(previous);
		previous.focus();

		vi.useFakeTimers();
		const trap = modalFocusTrap(container);
		vi.runAllTimers();
		expect(document.activeElement).toBe(first);

		last.focus();
		const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
		const preventForward = vi.spyOn(forward, 'preventDefault');
		container.dispatchEvent(forward);
		expect(preventForward).toHaveBeenCalledOnce();
		expect(document.activeElement).toBe(first);

		first.focus();
		const backward = new KeyboardEvent('keydown', {
			key: 'Tab',
			shiftKey: true,
			bubbles: true
		});
		const preventBackward = vi.spyOn(backward, 'preventDefault');
		container.dispatchEvent(backward);
		expect(preventBackward).toHaveBeenCalledOnce();
		expect(document.activeElement).toBe(last);

		first.focus();
		const interior = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
		const preventInterior = vi.spyOn(interior, 'preventDefault');
		container.dispatchEvent(interior);
		expect(preventInterior).not.toHaveBeenCalled();

		const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
		const preventEscape = vi.spyOn(escape, 'preventDefault');
		container.dispatchEvent(escape);
		expect(preventEscape).not.toHaveBeenCalled();

		trap.destroy();
		expect(document.activeElement).toBe(previous);

		last.focus();
		const afterDestroy = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
		const preventAfterDestroy = vi.spyOn(afterDestroy, 'preventDefault');
		container.dispatchEvent(afterDestroy);
		expect(preventAfterDestroy).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(last);
	});

	test('focuses the container when no focusable children exist', () => {
		container.tabIndex = -1;
		vi.useFakeTimers();
		const trap = modalFocusTrap(container);
		vi.runAllTimers();
		expect(document.activeElement).toBe(container);

		const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
		const preventTab = vi.spyOn(tab, 'preventDefault');
		container.dispatchEvent(tab);
		expect(preventTab).toHaveBeenCalledOnce();
		expect(document.activeElement).toBe(container);
		trap.destroy();
	});
});
