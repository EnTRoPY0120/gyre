export type FocusTrapAction = 'ignore' | 'focus-container' | 'focus-first' | 'focus-last';

export function getFocusTrapAction(
	key: string,
	focusableCount: number,
	shiftKey: boolean,
	activeIndex: number
): FocusTrapAction {
	if (key !== 'Tab') return 'ignore';
	if (focusableCount === 0) return 'focus-container';
	if (shiftKey && activeIndex === 0) return 'focus-last';
	if (!shiftKey && activeIndex === focusableCount - 1) return 'focus-first';
	return 'ignore';
}
