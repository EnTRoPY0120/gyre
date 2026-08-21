export type ReferenceKeyAction =
	| { type: 'toggle'; preventDefault: true }
	| { type: 'move'; index: number; preventDefault: true }
	| { type: 'select'; index: number; preventDefault: true }
	| { type: 'close'; preventDefault: boolean }
	| { type: 'none'; preventDefault: boolean };

export function getReferenceKeyAction(
	key: string,
	open: boolean,
	focusedIndex: number,
	resourceCount: number
): ReferenceKeyAction {
	if (!open) {
		return ['Enter', 'ArrowDown', 'ArrowUp'].includes(key)
			? { type: 'toggle', preventDefault: true }
			: { type: 'none', preventDefault: false };
	}

	if (key === 'ArrowDown') {
		return resourceCount > 0
			? { type: 'move', index: (focusedIndex + 1) % resourceCount, preventDefault: true }
			: { type: 'none', preventDefault: true };
	}

	if (key === 'ArrowUp') {
		return resourceCount > 0
			? {
					type: 'move',
					index: focusedIndex <= 0 ? resourceCount - 1 : focusedIndex - 1,
					preventDefault: true
				}
			: { type: 'none', preventDefault: true };
	}

	if (key === 'Enter') {
		return focusedIndex >= 0 && focusedIndex < resourceCount
			? { type: 'select', index: focusedIndex, preventDefault: true }
			: { type: 'none', preventDefault: true };
	}

	if (key === 'Escape') return { type: 'close', preventDefault: true };
	if (key === 'Tab') return { type: 'close', preventDefault: false };
	return { type: 'none', preventDefault: false };
}
