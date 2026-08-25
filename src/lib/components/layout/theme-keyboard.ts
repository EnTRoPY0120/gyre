export type ThemeKeyAction =
	| { type: 'open'; index: number; preventDefault: true }
	| { type: 'close'; preventDefault: boolean }
	| { type: 'move'; index: number; preventDefault: true }
	| { type: 'select'; preventDefault: true }
	| { type: 'none'; preventDefault: false };

export interface ThemeButtonKeyActionHandlers {
	preventDefault: () => void;
	open: (index: number) => void;
	move: (index: number) => void;
	close: () => void;
}

export interface ThemeMenuItemKeyActionHandlers {
	preventDefault: () => void;
	select: () => void;
	move: (index: number) => void;
	close: () => void;
}

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

export function applyThemeButtonKeyAction(
	action: ThemeKeyAction,
	handlers: ThemeButtonKeyActionHandlers
): void {
	if (action.preventDefault) handlers.preventDefault();
	switch (action.type) {
		case 'open':
			handlers.open(action.index);
			break;
		case 'move':
			handlers.move(action.index);
			break;
		case 'close':
			handlers.close();
			break;
	}
}

export function applyThemeMenuItemKeyAction(
	action: ThemeKeyAction,
	handlers: ThemeMenuItemKeyActionHandlers
): void {
	if (action.preventDefault) handlers.preventDefault();
	switch (action.type) {
		case 'select':
			handlers.select();
			break;
		case 'move':
			handlers.move(action.index);
			break;
		case 'close':
			handlers.close();
			break;
	}
}
