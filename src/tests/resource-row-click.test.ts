import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { isResourceSelectionTarget } from '../lib/components/flux/resource-row-click.js';

class FakeElement {
	type = '';
	closest = vi.fn<(selector: string) => FakeElement | null>(() => null);
}

class FakeInputElement extends FakeElement {}

describe('isResourceSelectionTarget', () => {
	const previousHTMLElement = globalThis.HTMLElement;
	const previousHTMLInputElement = globalThis.HTMLInputElement;

	beforeEach(() => {
		vi.stubGlobal('HTMLElement', FakeElement);
		vi.stubGlobal('HTMLInputElement', FakeInputElement);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		if (previousHTMLElement !== undefined) vi.stubGlobal('HTMLElement', previousHTMLElement);
		if (previousHTMLInputElement !== undefined) {
			vi.stubGlobal('HTMLInputElement', previousHTMLInputElement);
		}
	});

	test('recognizes checkbox inputs directly', () => {
		const checkbox = new FakeInputElement();
		checkbox.type = 'checkbox';

		expect(isResourceSelectionTarget(checkbox as unknown as EventTarget)).toBe(true);
		expect(isResourceSelectionTarget(new FakeInputElement() as unknown as EventTarget)).toBe(false);
	});

	test('recognizes clicks on elements nested inside a checkbox', () => {
		const checkbox = new FakeInputElement();
		const nested = new FakeElement();
		nested.closest.mockReturnValue(checkbox);

		expect(isResourceSelectionTarget(nested as unknown as EventTarget)).toBe(true);
	});

	test('allows normal row targets and non-element events', () => {
		expect(isResourceSelectionTarget(new FakeElement() as unknown as EventTarget)).toBe(false);
		expect(isResourceSelectionTarget(null)).toBe(false);
	});
});
