export interface CommandItem {
	id: string;
	label: string;
	description?: string;
	icon: string;
	href?: string;
	action?: () => void;
	category: string;
	keywords?: string[];
}

export interface HighlightSegment {
	text: string;
	highlighted: boolean;
}

export interface SearchResult {
	item: CommandItem;
	labelSegments: HighlightSegment[];
	descSegments: HighlightSegment[] | null;
	labelKeyword: boolean;
	descKeyword: boolean;
}
