import type * as Monaco from 'monaco-editor';

let themesRegistered = false;

/**
 * Defines custom Monaco Editor themes matching Gyre's zinc/amber design system.
 * Registers both 'gyre-dark' and 'gyre-light' themes.
 * Safe to call multiple times — registers only once.
 */
export function defineMonacoThemes(monaco: typeof Monaco): void {
	if (themesRegistered) return;
	themesRegistered = true;

	// TailwindCSS zinc palette (hex without #)
	const zinc = {
		100: 'f4f4f5',
		200: 'e4e4e7',
		300: 'd4d4d8',
		400: 'a1a1aa',
		500: '71717a',
		600: '52525b',
		700: '3f3f46',
		800: '27272a',
		900: '18181b',
		950: '09090b'
	};

	// TailwindCSS amber palette (hex without #)
	const amber = {
		300: 'fcd34d',
		400: 'fbbf24',
		500: 'f59e0b',
		600: 'd97706'
	};

	monaco.editor.defineTheme('gyre-dark', {
		base: 'vs-dark',
		inherit: true,
		rules: [
			// YAML tokens
			{ token: 'comment.yaml', foreground: zinc[600], fontStyle: 'italic' },
			{ token: 'string.yaml', foreground: '7dd3fc' }, // sky-300
			{ token: 'string.block.yaml', foreground: '7dd3fc' },
			{ token: 'number.yaml', foreground: 'fb923c' }, // orange-400
			{ token: 'keyword.yaml', foreground: amber[400] }, // true/false/null
			{ token: 'type.yaml', foreground: 'c084fc' }, // anchors — purple-400
			{ token: 'metatag.yaml', foreground: amber[500], fontStyle: 'bold' }, // ---/...
			{ token: 'operators.yaml', foreground: zinc[500] }, // : { } [ ]
			{ token: 'tag.yaml', foreground: 'c084fc' },
			{ token: 'namespace.yaml', foreground: zinc[400] },
			// JSON tokens
			{ token: 'string.value.json', foreground: '7dd3fc' },
			{ token: 'string.key.json', foreground: amber[300] },
			{ token: 'number.json', foreground: 'fb923c' },
			{ token: 'keyword.json', foreground: amber[400] },
			{ token: 'delimiter.bracket.json', foreground: zinc[500] },
			{ token: 'delimiter.comma.json', foreground: zinc[500] }
		],
		colors: {
			'editor.background': '#09090b',
			'editor.foreground': `#${zinc[300]}`,
			'editorCursor.foreground': `#${amber[500]}`,
			'editorCursor.background': '#09090b',
			'editor.lineHighlightBackground': `#${zinc[900]}`,
			'editor.lineHighlightBorder': '#00000000',
			'editor.selectionBackground': `#${zinc[700]}80`,
			'editor.inactiveSelectionBackground': `#${zinc[800]}60`,
			'editor.findMatchBackground': `#${amber[500]}33`,
			'editor.findMatchHighlightBackground': `#${amber[500]}1a`,
			'editor.findMatchBorder': `#${amber[500]}`,
			'editorGutter.background': '#09090b',
			'editorLineNumber.foreground': `#${zinc[700]}`,
			'editorLineNumber.activeForeground': `#${zinc[500]}`,
			'editorWidget.background': `#${zinc[900]}`,
			'editorWidget.border': `#${zinc[700]}`,
			'editorWidget.foreground': `#${zinc[300]}`,
			'editorSuggestWidget.background': `#${zinc[900]}`,
			'editorSuggestWidget.border': `#${zinc[700]}`,
			'editorSuggestWidget.foreground': `#${zinc[300]}`,
			'editorSuggestWidget.selectedBackground': `#${zinc[800]}`,
			'editorSuggestWidget.selectedForeground': `#${amber[400]}`,
			'editorSuggestWidget.highlightForeground': `#${amber[500]}`,
			'editorSuggestWidget.focusHighlightForeground': `#${amber[400]}`,
			'editorHoverWidget.background': `#${zinc[900]}`,
			'editorHoverWidget.border': `#${zinc[700]}`,
			'editorHoverWidget.foreground': `#${zinc[300]}`,
			'editorError.foreground': '#ef4444',
			'editorWarning.foreground': `#${amber[500]}`,
			'editorInfo.foreground': '#38bdf8',
			'scrollbarSlider.background': `#${zinc[700]}80`,
			'scrollbarSlider.hoverBackground': `#${zinc[600]}`,
			'scrollbarSlider.activeBackground': `#${zinc[500]}`,
			'minimap.background': '#09090b',
			'minimap.selectionHighlight': `#${amber[500]}40`,
			'editorBracketMatch.background': `#${zinc[700]}40`,
			'editorBracketMatch.border': `#${zinc[500]}`,
			'editorIndentGuide.background1': `#${zinc[800]}`,
			'editorIndentGuide.activeBackground1': `#${zinc[700]}`,
			'editorRuler.foreground': `#${zinc[800]}`
		}
	});

	monaco.editor.defineTheme('gyre-light', {
		base: 'vs',
		inherit: true,
		rules: [
			{ token: 'comment.yaml', foreground: zinc[400], fontStyle: 'italic' },
			{ token: 'string.yaml', foreground: '0369a1' }, // sky-700
			{ token: 'string.block.yaml', foreground: '0369a1' },
			{ token: 'number.yaml', foreground: 'c2410c' }, // orange-700
			{ token: 'keyword.yaml', foreground: amber[600] },
			{ token: 'type.yaml', foreground: '7e22ce' }, // purple-700
			{ token: 'metatag.yaml', foreground: amber[600], fontStyle: 'bold' },
			{ token: 'operators.yaml', foreground: zinc[500] },
			{ token: 'string.value.json', foreground: '0369a1' },
			{ token: 'string.key.json', foreground: amber[600] },
			{ token: 'number.json', foreground: 'c2410c' },
			{ token: 'keyword.json', foreground: amber[600] }
		],
		colors: {
			'editor.background': '#ffffff',
			'editor.foreground': `#${zinc[900]}`,
			'editorCursor.foreground': `#${amber[600]}`,
			'editor.lineHighlightBackground': `#${zinc[100]}`,
			'editor.lineHighlightBorder': '#00000000',
			'editor.selectionBackground': `#${zinc[200]}`,
			'editor.inactiveSelectionBackground': `#${zinc[100]}`,
			'editor.findMatchBackground': `#${amber[400]}40`,
			'editor.findMatchHighlightBackground': `#${amber[400]}20`,
			'editorLineNumber.foreground': `#${zinc[300]}`,
			'editorLineNumber.activeForeground': `#${zinc[500]}`,
			'editorWidget.background': '#ffffff',
			'editorWidget.border': `#${zinc[200]}`,
			'editorSuggestWidget.background': '#ffffff',
			'editorSuggestWidget.border': `#${zinc[200]}`,
			'editorSuggestWidget.foreground': `#${zinc[900]}`,
			'editorSuggestWidget.selectedBackground': `#${zinc[100]}`,
			'editorSuggestWidget.selectedForeground': `#${amber[600]}`,
			'editorSuggestWidget.highlightForeground': `#${amber[600]}`,
			'editorHoverWidget.background': '#ffffff',
			'editorHoverWidget.border': `#${zinc[200]}`,
			'editorError.foreground': '#dc2626',
			'editorWarning.foreground': `#${amber[600]}`,
			'scrollbarSlider.background': `#${zinc[200]}`,
			'scrollbarSlider.hoverBackground': `#${zinc[300]}`,
			'scrollbarSlider.activeBackground': `#${zinc[400]}`,
			'editorBracketMatch.background': `#${zinc[100]}`,
			'editorBracketMatch.border': `#${zinc[400]}`,
			'editorIndentGuide.background1': `#${zinc[100]}`,
			'editorIndentGuide.activeBackground1': `#${zinc[300]}`
		}
	});
}
