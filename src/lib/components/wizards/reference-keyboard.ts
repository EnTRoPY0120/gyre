export type ReferenceKeyAction =
	| { type: 'toggle'; preventDefault: true }
	| { type: 'move'; index: number; preventDefault: true }
	| { type: 'select'; index: number; preventDefault: true }
	| { type: 'close'; preventDefault: boolean }
	| { type: 'none'; preventDefault: boolean };

function getClosedPickerAction(key: string): ReferenceKeyAction {
	return ['Enter', 'ArrowDown', 'ArrowUp'].includes(key)
		? { type: 'toggle', preventDefault: true }
		: { type: 'none', preventDefault: false };
}

function getMovementAction(
	key: string,
	focusedIndex: number,
	resourceCount: number
): ReferenceKeyAction | null {
	if (key === 'ArrowDown') {
		return resourceCount > 0
			? { type: 'move', index: (focusedIndex + 1) % resourceCount, preventDefault: true }
			: { type: 'none', preventDefault: true };
	}

	if (key !== 'ArrowUp') return null;
	return resourceCount > 0
		? {
				type: 'move',
				index: focusedIndex <= 0 ? resourceCount - 1 : focusedIndex - 1,
				preventDefault: true
			}
		: { type: 'none', preventDefault: true };
}

function getSelectionAction(focusedIndex: number, resourceCount: number): ReferenceKeyAction {
	return focusedIndex >= 0 && focusedIndex < resourceCount
		? { type: 'select', index: focusedIndex, preventDefault: true }
		: { type: 'none', preventDefault: true };
}

export function getReferenceKeyAction(
	key: string,
	open: boolean,
	focusedIndex: number,
	resourceCount: number
): ReferenceKeyAction {
	if (!open) return getClosedPickerAction(key);

	const movementAction = getMovementAction(key, focusedIndex, resourceCount);
	if (movementAction) return movementAction;
	if (key === 'Enter') return getSelectionAction(focusedIndex, resourceCount);

	if (key === 'Escape') return { type: 'close', preventDefault: true };
	if (key === 'Tab') return { type: 'close', preventDefault: false };
	return { type: 'none', preventDefault: false };
}
