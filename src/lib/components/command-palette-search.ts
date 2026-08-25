import { highlightText } from './command-palette-highlighting.js';
import type { CommandItem, SearchResult } from './CommandPaletteTypes.js';

function isKeywordMatch(text: string, query: string): boolean {
	const trimmed = query.trim().toLowerCase();
	return trimmed.length > 0 && text.toLowerCase().includes(trimmed);
}

export function buildCommandPaletteSearchResult(
	item: CommandItem,
	labelIndices: readonly [number, number][] | undefined,
	descriptionIndices: readonly [number, number][] | undefined,
	query: string
): SearchResult {
	return {
		item,
		labelSegments: highlightText(item.label, labelIndices),
		descSegments: item.description ? highlightText(item.description, descriptionIndices) : null,
		labelKeyword: isKeywordMatch(item.label, query),
		descKeyword: isKeywordMatch(item.description ?? '', query)
	};
}
