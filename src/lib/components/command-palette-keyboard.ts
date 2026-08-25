export type CommandPaletteKeyAction =
	| { type: 'move'; index: number; preventDefault: true }
	| { type: 'select'; preventDefault: true }
	| { type: 'none'; preventDefault: false };

export function getCommandPaletteKeyAction(
	key: string,
	selectedIndex: number,
	itemCount: number
): CommandPaletteKeyAction {
	if (key === 'ArrowDown') {
		return {
			type: 'move',
			index: Math.min(selectedIndex + 1, Math.max(itemCount - 1, 0)),
			preventDefault: true
		};
	}

	if (key === 'ArrowUp') {
		return { type: 'move', index: Math.max(selectedIndex - 1, 0), preventDefault: true };
	}

	if (key === 'Enter') return { type: 'select', preventDefault: true };
	return { type: 'none', preventDefault: false };
}
