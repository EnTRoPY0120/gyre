export type UserMenuKeyAction =
	| { type: 'move'; index: number }
	| { type: 'close'; restoreFocus: boolean; preventDefault: boolean }
	| { type: 'ignore' };

export interface UserMenuKeyActionHandlers {
	preventDefault: () => void;
	move: (index: number) => void;
	close: (restoreFocus: boolean) => void;
}

const MENU_KEY_ACTIONS: Record<
	string,
	(index: number, itemCount: number) => Exclude<UserMenuKeyAction, { type: 'ignore' }>
> = {
	ArrowDown: (index, itemCount) => ({ type: 'move', index: (index + 1) % itemCount }),
	ArrowUp: (index, itemCount) => ({
		type: 'move',
		index: index <= 0 ? itemCount - 1 : index - 1
	}),
	Escape: () => ({ type: 'close', restoreFocus: true, preventDefault: true }),
	Tab: () => ({ type: 'close', restoreFocus: false, preventDefault: false })
};

export function getUserMenuKeyAction(
	key: string,
	open: boolean,
	index: number,
	itemCount: number
): UserMenuKeyAction {
	if (!open) return { type: 'ignore' };
	return MENU_KEY_ACTIONS[key]?.(index, itemCount) ?? { type: 'ignore' };
}

export function applyUserMenuKeyAction(
	action: UserMenuKeyAction,
	handlers: UserMenuKeyActionHandlers
): void {
	switch (action.type) {
		case 'move':
			handlers.preventDefault();
			handlers.move(action.index);
			break;
		case 'close':
			if (action.preventDefault) handlers.preventDefault();
			handlers.close(action.restoreFocus);
			break;
		case 'ignore':
			break;
	}
}
