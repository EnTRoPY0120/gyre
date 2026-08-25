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

export function restoreFocus(previousActiveElement: HTMLElement | null): void {
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

export { getFocusableElements };
