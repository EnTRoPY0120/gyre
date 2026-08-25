import { beforeAll, describe, expect, test, vi } from 'vitest';
import type * as Monaco from 'monaco-editor';
import { registerFluxLanguageFeatures } from '../lib/components/editors/fluxCompletions.js';

type HoverProvider = {
	provideHover: (
		model: Monaco.editor.ITextModel,
		position: Monaco.Position
	) => Monaco.languages.Hover | null;
};

const hoverProviders: HoverProvider[] = [];
const monaco = {
	Range: class {
		constructor(
			readonly startLineNumber: number,
			readonly startColumn: number,
			readonly endLineNumber: number,
			readonly endColumn: number
		) {}
	},
	languages: {
		CompletionItemKind: { Field: 1, Value: 2 },
		CompletionItemInsertTextRule: { None: 0 },
		registerCompletionItemProvider: vi.fn(),
		registerHoverProvider: vi.fn((_language: string, provider: HoverProvider) => {
			hoverProviders.push(provider);
		})
	}
} as unknown as typeof Monaco;

beforeAll(() => {
	registerFluxLanguageFeatures(monaco);
});

function createModel(lines: string[], word: Monaco.editor.IWordAtPosition | null) {
	return {
		getLinesContent: () => lines,
		getWordAtPosition: () => word
	} as unknown as Monaco.editor.ITextModel;
}

describe('Flux Monaco language features', () => {
	test('shows context-specific hover documentation for nested fields', () => {
		const provider = hoverProviders[0];
		const hover = provider.provideHover(
			createModel(['kind: GitRepository', 'spec:', '  url: https://example.com'], {
				word: 'url',
				startColumn: 3,
				endColumn: 6
			}),
			{ lineNumber: 3, column: 5 } as Monaco.Position
		);

		expect(hover).toMatchObject({
			contents: [
				{ value: '**url** — Repository URL' },
				{ value: expect.stringContaining('URL of the Git repository') }
			]
		});
	});

	test('does not offer hover content when the cursor is not on a YAML key', () => {
		const provider = hoverProviders[0];
		const hover = provider.provideHover(
			createModel(['kind: GitRepository', 'spec:', '  url'], {
				word: 'url',
				startColumn: 3,
				endColumn: 6
			}),
			{ lineNumber: 3, column: 5 } as Monaco.Position
		);

		expect(hover).toBeNull();
	});
});
