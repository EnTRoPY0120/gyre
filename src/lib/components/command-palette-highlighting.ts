import type { HighlightSegment } from './CommandPaletteTypes';

export function highlightText(
	text: string,
	indices?: readonly [number, number][]
): HighlightSegment[] {
	if (!indices || indices.length === 0) return [{ text, highlighted: false }];

	const segments: HighlightSegment[] = [];
	let lastIndex = 0;
	for (const [start, end] of indices) {
		if (start > lastIndex)
			segments.push({ text: text.slice(lastIndex, start), highlighted: false });
		segments.push({ text: text.slice(start, end + 1), highlighted: true });
		lastIndex = end + 1;
	}
	if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), highlighted: false });
	return segments;
}
