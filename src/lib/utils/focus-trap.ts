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
		if (event.key !== 'Tab') return;

		const focusables = getFocusableElements(node);
		if (focusables.length === 0) {
			event.preventDefault();
			node.focus();
			return;
		}

		const first = focusables[0];
		const last = focusables[focusables.length - 1];

		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	};

	node.addEventListener('keydown', handleKeydown);
	setTimeout(focusInitialElement, 0);

	return {
		destroy() {
			node.removeEventListener('keydown', handleKeydown);
			const livePreviousActiveElement =
				previousActiveElement?.isConnected &&
				previousActiveElement.ownerDocument?.contains(previousActiveElement)
					? previousActiveElement
					: null;
			const fallbackFocusTarget =
				document.activeElement instanceof HTMLElement && document.activeElement.isConnected
					? document.activeElement
					: document.body;

			(livePreviousActiveElement ?? fallbackFocusTarget).focus();
			previousActiveElement = null;
		}
	};
}
