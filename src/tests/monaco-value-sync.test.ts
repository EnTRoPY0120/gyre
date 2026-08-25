import { describe, expect, test, vi } from 'vitest';
import { syncEditorValue } from '../lib/components/editors/monaco-value-sync.js';

describe('Monaco external value synchronization', () => {
	test('updates content while preserving cursor and scroll state', () => {
		const editor = {
			getValue: vi.fn(() => 'old'),
			getPosition: vi.fn(() => ({ lineNumber: 3, column: 5 })),
			getScrollTop: vi.fn(() => 240),
			setValue: vi.fn(),
			setPosition: vi.fn(),
			setScrollTop: vi.fn()
		};

		expect(syncEditorValue(editor, 'new')).toBe(true);
		expect(editor.setValue).toHaveBeenCalledWith('new');
		expect(editor.setPosition).toHaveBeenCalledWith({ lineNumber: 3, column: 5 });
		expect(editor.setScrollTop).toHaveBeenCalledWith(240);
	});

	test('does not reset the editor when content is already current', () => {
		const editor = {
			getValue: vi.fn(() => 'same'),
			getPosition: vi.fn(),
			getScrollTop: vi.fn(),
			setValue: vi.fn(),
			setPosition: vi.fn(),
			setScrollTop: vi.fn()
		};

		expect(syncEditorValue(editor, 'same')).toBe(false);
		expect(editor.setValue).not.toHaveBeenCalled();
	});
});
