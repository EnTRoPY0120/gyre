import { getFocusTrapAction } from './focus-trap-logic.js';
import {
	getFocusableElements,
	getInitialFocusTarget,
	makeLabelledElementFocusable,
	restoreFocus
} from './focus-trap-dom.js';

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
