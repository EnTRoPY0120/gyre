import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
	getInitialFocusTarget,
	makeLabelledElementFocusable,
	modalFocusTrap
} from '../lib/utils/focus-trap.js';

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

interface FakeDocument {
	activeElement: FakeElement | null;
	body: FakeElement;
	contains: (element: FakeElement) => boolean;
	getElementById: (id: string) => FakeElement | null;
}

class FakeElement {
	isConnected = true;
	tabIndex = 0;
	attributes = new Set<string>();
	focusCount = 0;
	ownerDocument: FakeDocument;
	private readonly values = new Map<string, string>();
	private children: FakeElement[] = [];
	private document: FakeDocument;

	constructor(document: FakeDocument) {
		this.document = document;
		this.ownerDocument = document;
	}

	setAttribute(name: string, value: string) {
		this.attributes.add(name);
		this.values.set(name, value);
	}

	hasAttribute(name: string): boolean {
		return this.attributes.has(name);
	}

	getAttribute(name: string): string | null {
		return this.values.get(name) ?? null;
	}

	querySelectorAll<T extends Element>(): T[] {
		return this.children as T[];
	}

	querySelector<T extends Element>(): T | null {
		return (this.children[0] as T | undefined) ?? null;
	}

	setChildren(children: FakeElement[]) {
		this.children = children;
	}

	addEventListener(_type: string, _handler: EventListenerOrEventListenerObject) {}

	removeEventListener(_type: string, _handler: EventListenerOrEventListenerObject) {}

	focus() {
		this.focusCount += 1;
		this.document.activeElement = this;
	}
}

let fakeDocument: FakeDocument;
let previousDocument: typeof globalThis.document | undefined;
let previousHTMLElement: typeof globalThis.HTMLElement | undefined;

beforeEach(() => {
	fakeDocument = {
		activeElement: null,
		body: null as unknown as FakeElement,
		contains: (element) => element.isConnected,
		getElementById: () => null
	};
	fakeDocument.body = new FakeElement(fakeDocument);
	fakeDocument.activeElement = fakeDocument.body;
	previousDocument = globalThis.document;
	previousHTMLElement = globalThis.HTMLElement;
	Object.defineProperty(globalThis, 'document', { configurable: true, value: fakeDocument });
	Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: FakeElement });
});

afterEach(() => {
	if (previousDocument === undefined) delete (globalThis as { document?: unknown }).document;
	else
		Object.defineProperty(globalThis, 'document', { configurable: true, value: previousDocument });
	if (previousHTMLElement === undefined)
		delete (globalThis as { HTMLElement?: unknown }).HTMLElement;
	else
		Object.defineProperty(globalThis, 'HTMLElement', {
			configurable: true,
			value: previousHTMLElement
		});
	vi.useRealTimers();
});

describe('modalFocusTrap', () => {
	test('wraps focus at both ends and ignores interior or unrelated keys', () => {
		const previous = new FakeElement(fakeDocument);
		const first = new FakeElement(fakeDocument);
		const last = new FakeElement(fakeDocument);
		const node = new FakeElement(fakeDocument);
		node.setChildren([first, last]);
		const listeners = new Map<string, (event: KeyboardEvent) => void>();
		(node as FakeElement & { addEventListener: typeof node.addEventListener }).addEventListener = (
			type,
			handler
		) => listeners.set(type, handler as (event: KeyboardEvent) => void);
		(
			node as FakeElement & { removeEventListener: typeof node.removeEventListener }
		).removeEventListener = (type) => listeners.delete(type);
		fakeDocument.activeElement = previous;

		vi.useFakeTimers();
		const trap = modalFocusTrap(node as unknown as HTMLElement);
		vi.runAllTimers();
		expect(first.focusCount).toBe(1);

		fakeDocument.activeElement = last;
		const forward = {
			key: 'Tab',
			shiftKey: false,
			preventDefault: vi.fn()
		} as unknown as KeyboardEvent;
		listeners.get('keydown')?.(forward);
		expect(forward.preventDefault).toHaveBeenCalledOnce();
		expect(first.focusCount).toBe(2);

		fakeDocument.activeElement = first;
		const backward = {
			key: 'Tab',
			shiftKey: true,
			preventDefault: vi.fn()
		} as unknown as KeyboardEvent;
		listeners.get('keydown')?.(backward);
		expect(last.focusCount).toBe(1);

		fakeDocument.activeElement = first;
		const interior = {
			key: 'Tab',
			shiftKey: false,
			preventDefault: vi.fn()
		} as unknown as KeyboardEvent;
		listeners.get('keydown')?.(interior);
		expect(interior.preventDefault).not.toHaveBeenCalled();

		const escape = {
			key: 'Escape',
			shiftKey: false,
			preventDefault: vi.fn()
		} as unknown as KeyboardEvent;
		listeners.get('keydown')?.(escape);
		expect(escape.preventDefault).not.toHaveBeenCalled();

		trap.destroy();
		expect(listeners.has('keydown')).toBe(false);
		expect(fakeDocument.activeElement).toBe(previous);
		expect(previous.focusCount).toBe(1);
	});

	test('focuses the container when no focusable children exist', () => {
		const node = new FakeElement(fakeDocument);
		node.setChildren([]);
		let handler: ((event: KeyboardEvent) => void) | undefined;
		(node as FakeElement & { addEventListener: typeof node.addEventListener }).addEventListener = (
			_type,
			listener
		) => {
			handler = listener as (event: KeyboardEvent) => void;
		};
		(
			node as FakeElement & { removeEventListener: typeof node.removeEventListener }
		).removeEventListener = () => {};

		vi.useFakeTimers();
		const trap = modalFocusTrap(node as unknown as HTMLElement);
		vi.runAllTimers();
		handler?.({ key: 'Tab', shiftKey: false, preventDefault: vi.fn() } as unknown as KeyboardEvent);

		expect(node.focusCount).toBe(2);
		trap.destroy();
	});
});
