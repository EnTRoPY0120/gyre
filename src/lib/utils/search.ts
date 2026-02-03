import Fuse from 'fuse.js';

export interface SearchOptions {
	fuzzy?: boolean;
	regex?: boolean;
	caseSensitive?: boolean;
	keys?: string[];
}

/**
 * Advanced search utility supporting fuzzy, regex, and literal matching
 */
export function advancedSearch<T>(items: T[], query: string, options: SearchOptions = {}): T[] {
	if (!query) return items;

	const {
		fuzzy = true,
		regex = false,
		caseSensitive = false,
		keys = ['metadata.name', 'metadata.namespace', 'status.conditions.message']
	} = options;

	// Handle Regex search
	if (regex) {
		try {
			const re = new RegExp(query, caseSensitive ? '' : 'i');
			return items.filter((item) => {
				const searchString = getSearchString(item, keys);
				return re.test(searchString);
			});
		} catch (e) {
			// If regex is invalid, fallback to literal search or return empty
			console.error('Invalid regex:', e);
			return [];
		}
	}

	// Handle Fuzzy search
	if (fuzzy) {
		const fuse = new Fuse(items, {
			keys,
			threshold: 0.3,
			distance: 100,
			ignoreLocation: true,
			useExtendedSearch: true,
			isCaseSensitive: caseSensitive
		});
		return fuse.search(query).map((result) => result.item);
	}

	// Handle Literal search (fallback)
	const normalizedQuery = caseSensitive ? query : query.toLowerCase();
	return items.filter((item) => {
		const searchString = getSearchString(item, keys);
		const normalizedString = caseSensitive ? searchString : searchString.toLowerCase();
		return normalizedString.includes(normalizedQuery);
	});
}

/**
 * Extract a single string from an object based on keys for simple regex/literal matching
 */
function getSearchString(obj: any, keys: string[]): string {
	return keys
		.map((key) => {
			const path = key.split('.');
			let current = obj;
			for (const p of path) {
				if (current && typeof current === 'object' && p in current) {
					current = current[p];
				} else {
					current = undefined;
					break;
				}
			}
			return current ? String(current) : '';
		})
		.join(' ');
}

/**
 * Parse a search query into tags and text
 * Example: "nginx ns:default status:ready" -> { query: "nginx", tags: { ns: "default", status: "ready" } }
 */
export function parseQuery(query: string) {
	const tags: Record<string, string> = {};
	let processedQuery = query;

	const tagRegex = /(\w+):([^\s]+)/g;
	let match;

	while ((match = tagRegex.exec(query)) !== null) {
		const [fullMatch, key, value] = match;
		tags[key] = value;
		processedQuery = processedQuery.replace(fullMatch, '');
	}

	return {
		query: processedQuery.trim(),
		tags
	};
}
