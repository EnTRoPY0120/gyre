import type * as Monaco from 'monaco-editor';

type EditorValueAdapter = Pick<
	Monaco.editor.IStandaloneCodeEditor,
	'getValue' | 'getPosition' | 'getScrollTop' | 'setValue' | 'setPosition' | 'setScrollTop'
>;

export function syncEditorValue(editor: EditorValueAdapter, value: string): boolean {
	if (editor.getValue() === value) return false;

	const position = editor.getPosition();
	const scrollTop = editor.getScrollTop();
	editor.setValue(value);

	if (position) editor.setPosition(position);
	editor.setScrollTop(scrollTop);
	return true;
}
