import Fuse from 'fuse.js';
import safeRegex from 'safe-regex2';
import { logger } from './logger.js';

export const MAX_QUERY_LENGTH = 500;
const MAX_TAG_VALUE_LENGTH = 200;

export interface SearchOptions {
	fuzzy?: boolean;
	regex?: boolean;
	caseSensitive?: boolean;
	keys?: string[];
}

// Cache Fuse instances keyed by items reference then by serialized options.
// WeakMap allows entries to be garbage collected when the items array is no longer in use.
const fuseCache = new WeakMap<object, Map<string, Fuse<unknown>>>();

/**
 * Returns a cached Fuse instance for the given items array and options.
 *
 * **Callers must treat `items` as immutable.** The cache ({@link fuseCache}) is
 * keyed by the `items` array reference, so mutating the array in place will
 * cause {@link getFuseInstance} to return a stale index without rebuilding it.
 * Pass a new array reference whenever the contents change.
 *
 * Future improvement: include a content hash in the options key to
 * auto-detect in-place mutations.
 */
function getFuseInstance<T>(items: T[], keys: string[], caseSensitive: boolean): Fuse<T> {
	const optionsKey = JSON.stringify({ keys: [...keys].sort(), caseSensitive });

	let byOptions = fuseCache.get(items as object);
	if (!byOptions) {
		byOptions = new Map();
		fuseCache.set(items as object, byOptions);
	}

	let fuse = byOptions.get(optionsKey) as Fuse<T> | undefined;
	if (!fuse) {
		fuse = new Fuse(items, {
			keys,
			threshold: 0.3,
			distance: 100,
			ignoreLocation: true,
			useExtendedSearch: true,
			isCaseSensitive: caseSensitive
		});
		byOptions.set(optionsKey, fuse as Fuse<unknown>);
	}

	return fuse;
}

/**
 * Returns false if the pattern could cause catastrophic backtracking (ReDoS).
 * Delegates to safe-regex2 for comprehensive detection.
 */
function isSafeRegex(pattern: string): boolean {
	try {
		return safeRegex(pattern);
	} catch {
		return false;
	}
}

export interface RegexCompilation {
	regex: RegExp | null;
	error: string | null;
}

/** Compile the length-limited pattern used by resource filtering. */
export function compileRegex(pattern: string, caseSensitive = false): RegexCompilation {
	const truncatedPattern = pattern.slice(0, MAX_QUERY_LENGTH);
	if (!truncatedPattern) return { regex: null, error: null };
	let regex: RegExp;
	try {
		regex = new RegExp(truncatedPattern, caseSensitive ? '' : 'i');
	} catch {
		return { regex: null, error: 'This regular expression is invalid.' };
	}
	if (!isSafeRegex(truncatedPattern)) {
		return { regex: null, error: 'This pattern may cause performance issues.' };
	}
	return { regex, error: null };
}

/** Validate the parsed text portion of a resource search, including its length limit. */
export function validateResourceSearchRegex(query: string): RegexCompilation {
	return compileRegex(parseQuery(query).query);
}

/**
 * Advanced search utility supporting fuzzy, regex, and literal matching
 */
export function advancedSearch<T>(items: T[], query: string, options: SearchOptions = {}): T[] {
	if (!query) return items;

	const truncatedQuery = query.slice(0, MAX_QUERY_LENGTH);

	const {
		fuzzy = true,
		regex = false,
		caseSensitive = false,
		keys = ['metadata.name', 'metadata.namespace', 'status.conditions.message']
	} = options;

	// Handle Regex search
	if (regex) {
		const { regex: compiledRegex, error } = compileRegex(truncatedQuery, caseSensitive);
		if (error || !compiledRegex) {
			logger.debug(error ?? 'Empty regex search skipped');
			return [];
		}
		return items.filter((item) => {
			const searchString = getSearchString(item, keys);
			return compiledRegex.test(searchString);
		});
	}

	// Handle Fuzzy search
	if (fuzzy) {
		const fuse = getFuseInstance(items, keys, caseSensitive);
		return fuse.search(truncatedQuery).map((result) => result.item);
	}

	// Handle Literal search (fallback)
	const normalizedQuery = caseSensitive ? truncatedQuery : truncatedQuery.toLowerCase();
	return items.filter((item) => {
		const searchString = getSearchString(item, keys);
		const normalizedString = caseSensitive ? searchString : searchString.toLowerCase();
		return normalizedString.includes(normalizedQuery);
	});
}

/**
 * Extract a single string from an object based on keys for simple regex/literal matching
 */
function getSearchString(obj: unknown, keys: string[]): string {
	return keys
		.map((key) => {
			const path = key.split('.');
			let current: unknown = obj;
			for (const p of path) {
				if (current && typeof current === 'object' && p in current) {
					const record = current as Record<string, unknown>;
					current = record[p];
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
		tags[key] = value.slice(0, MAX_TAG_VALUE_LENGTH);
		processedQuery = processedQuery.replace(fullMatch, '');
	}

	return {
		query: processedQuery.trim(),
		tags
	};
}
