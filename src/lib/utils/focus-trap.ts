import { getFocusTrapAction } from './focus-trap-logic.js';

const FOCUSABLE_SELECTOR =
	'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
	return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
		(element) =>
			!element.hasAttribute('disabled') &&
			element.getAttribute('aria-hidden') !== 'true' &&
			element.tabIndex !== -1
	);
}

function getConnectedElement(element: HTMLElement | null): HTMLElement | null {
	if (!element?.isConnected || !element.ownerDocument?.contains(element)) return null;
	return element;
}

function restoreFocus(previousActiveElement: HTMLElement | null): void {
	const previousElement = getConnectedElement(previousActiveElement);
	const activeElement =
		document.activeElement instanceof HTMLElement ? document.activeElement : null;
	const fallbackElement = getConnectedElement(activeElement) ?? document.body;

	(previousElement ?? fallbackElement).focus();
}

export function getInitialFocusTarget(
	node: HTMLElement,
	labelledElement: HTMLElement | null
): HTMLElement {
	const initialFocusSelector = node.getAttribute('data-initial-focus');
	const initialFocusElement = initialFocusSelector
		? (node.querySelector<HTMLElement>(initialFocusSelector) ?? null)
		: null;
	return initialFocusElement ?? getFocusableElements(node)[0] ?? labelledElement ?? node;
}

export function makeLabelledElementFocusable(
	focusTarget: HTMLElement,
	labelledElement: HTMLElement | null
): void {
	if (
		focusTarget === labelledElement &&
		labelledElement &&
		!labelledElement.hasAttribute('tabindex')
	) {
		labelledElement.tabIndex = -1;
	}
}

export function modalFocusTrap(node: HTMLElement) {
	let previousActiveElement: HTMLElement | null =
		typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;

	const focusInitialElement = () => {
		const labelledBy = node.getAttribute('aria-labelledby');
		const labelledElement =
			labelledBy && typeof document !== 'undefined'
				? (document.getElementById(labelledBy) as HTMLElement | null)
				: null;
		const focusTarget = getInitialFocusTarget(node, labelledElement);
		makeLabelledElementFocusable(focusTarget, labelledElement);

		focusTarget.focus();
	};

	const handleKeydown = (event: KeyboardEvent) => {
		const focusables = getFocusableElements(node);
		const action = getFocusTrapAction(
			event.key,
			focusables.length,
			event.shiftKey,
			focusables.indexOf(document.activeElement as HTMLElement)
		);
		if (action === 'ignore') return;

		event.preventDefault();
		if (action === 'focus-container') {
			node.focus();
		} else if (action === 'focus-first') {
			focusables[0]?.focus();
		} else if (action === 'focus-last') {
			focusables.at(-1)?.focus();
		}
	};

	node.addEventListener('keydown', handleKeydown);
	setTimeout(focusInitialElement, 0);

	return {
		destroy() {
			node.removeEventListener('keydown', handleKeydown);
			restoreFocus(previousActiveElement);
			previousActiveElement = null;
		}
	};
}
