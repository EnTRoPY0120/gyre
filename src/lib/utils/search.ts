import Fuse from 'fuse.js';
import safeRegex from 'safe-regex2';
import { logger } from './logger.js';
import { RESOURCE_HEALTH_VALUES } from '$lib/types/view';

export const MAX_QUERY_LENGTH = 500;

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

export type SearchTagKey = 'ns' | 'status';

export interface SearchTag {
	key: SearchTagKey;
	value: string;
	start: number;
	end: number;
	error: string | null;
}

function validateTag(key: SearchTagKey, value: string): string | null {
	if (key === 'ns') {
		return value.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(value)
			? null
			: 'Namespace must be 1–63 lowercase letters, digits or hyphens, starting and ending with a letter or digit.';
	}
	return RESOURCE_HEALTH_VALUES.some((status) => status === value)
		? null
		: `Status must be ${RESOURCE_HEALTH_VALUES.join(', ')} or ready.`;
}

/** Remove only tag spans and their following separator; retain all other search text. */
function withoutTags(query: string, tags: SearchTag[]): string {
	let text = '';
	let cursor = 0;
	for (const tag of tags) {
		text += query.slice(cursor, tag.start);
		cursor = tag.end;
		// Consume one separator, not arbitrary whitespace that may be part of a regex.
		if (/\s/.test(query[cursor] ?? '')) cursor++;
	}
	return (text + query.slice(cursor)).trim();
}

/** Parse standalone, unescaped supported tags. Positions refer to the limited input. */
export function parseQuery(input: string) {
	const source = input.slice(0, MAX_QUERY_LENGTH);
	const occurrences: SearchTag[] = [];
	const effective = new Map<SearchTagKey, SearchTag>();
	// Whole tokens keep URLs, unknown prefixes and embedded regex fragments intact.
	for (const match of source.matchAll(/\S+/g)) {
		const tagMatch = /^(ns|namespace|status):(.*)$/.exec(match[0]);
		if (!tagMatch) continue;
		const key: SearchTagKey = tagMatch[1] === 'status' ? 'status' : 'ns';
		let value = tagMatch[2];
		if (key === 'status') {
			value = value.toLowerCase();
			if (value === 'ready') value = 'healthy';
		}
		const tag = {
			key,
			value,
			start: match.index,
			end: match.index + match[0].length,
			error: validateTag(key, value)
		};
		occurrences.push(tag);
		effective.set(key, tag);
	}
	const effectiveTags = [...effective.values()];
	return {
		query: withoutTags(source, occurrences),
		tags: Object.fromEntries(effectiveTags.map(({ key, value }) => [key, value])),
		occurrences,
		effectiveTags,
		errors: effectiveTags.filter((tag) => tag.error !== null)
	};
}

/** Remove all occurrences, including aliases and overridden values, of a query filter. */
export function removeSearchTag(query: string, key: SearchTagKey): string {
	const source = query.slice(0, MAX_QUERY_LENGTH);
	return withoutTags(
		source,
		parseQuery(source).occurrences.filter((tag) => tag.key === key)
	);
}
