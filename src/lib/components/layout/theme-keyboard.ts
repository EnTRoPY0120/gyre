export type ThemeKeyAction =
	| { type: 'open'; index: number; preventDefault: true }
	| { type: 'close'; preventDefault: boolean }
	| { type: 'move'; index: number; preventDefault: true }
	| { type: 'select'; preventDefault: true }
	| { type: 'none'; preventDefault: false };

export function getThemeButtonKeyAction(
	key: string,
	isOpen: boolean,
	selectedIndex: number,
	optionCount: number,
	initialIndex: number
): ThemeKeyAction {
	if (key === ' ' || key === 'Enter') {
		return isOpen
			? { type: 'close', preventDefault: true }
			: { type: 'open', index: initialIndex, preventDefault: true };
	}

	if (key === 'ArrowDown' && isOpen) {
		return { type: 'move', index: (selectedIndex + 1) % optionCount, preventDefault: true };
	}

	if (key === 'ArrowUp' && isOpen) {
		return {
			type: 'move',
			index: (selectedIndex - 1 + optionCount) % optionCount,
			preventDefault: true
		};
	}

	if (key === 'Escape') return { type: 'close', preventDefault: false };
	return { type: 'none', preventDefault: false };
}

export function getThemeMenuItemKeyAction(
	key: string,
	optionCount: number,
	selectedIndex: number
): ThemeKeyAction {
	if (key === 'Enter' || key === ' ') return { type: 'select', preventDefault: true };
	if (key === 'ArrowDown') {
		return { type: 'move', index: (selectedIndex + 1) % optionCount, preventDefault: true };
	}
	if (key === 'ArrowUp') {
		return {
			type: 'move',
			index: (selectedIndex - 1 + optionCount) % optionCount,
			preventDefault: true
		};
	}
	if (key === 'Escape') return { type: 'close', preventDefault: true };
	if (key === 'Tab') return { type: 'close', preventDefault: false };
	return { type: 'none', preventDefault: false };
}
