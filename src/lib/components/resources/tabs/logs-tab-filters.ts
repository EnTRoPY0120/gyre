import type { FormattedLogLine } from './logs-tab-types';

const REDOS_HEURISTIC =
	/\([^)]*[+*][^)]*\)[+*?]|\([^)]*\)[+*]\s*[+*]|\((?:\?(?::|<[^>]*>))?(?![^)]*[*+?{])[^)]*\|[^)]*\)[+*?]/;

export interface LogRegexState {
	regex: RegExp | null;
	error: string | null;
}

export interface LogFilterOptions {
	levelFilter: string;
	searchQuery: string;
	useRegex: boolean;
	regex: RegExp | null;
}

function isSafePattern(pattern: string): boolean {
	return !REDOS_HEURISTIC.test(pattern.replace(/\\./g, ''));
}

export function getLogRegexState(searchQuery: string, useRegex: boolean): LogRegexState {
	if (!useRegex || !searchQuery) return { regex: null, error: null };

	if (!isSafePattern(searchQuery)) {
		return { regex: null, error: 'Pattern may cause performance issues' };
	}

	try {
		return { regex: new RegExp(searchQuery, 'i'), error: null };
	} catch {
		return { regex: null, error: 'Invalid regular expression' };
	}
}

function matchesLevel(line: FormattedLogLine, levelFilter: string): boolean {
	return (
		levelFilter === 'ALL' ||
		line.level === levelFilter ||
		(levelFilter === 'WARN' && line.level === 'WARNING') ||
		(levelFilter === 'ERROR' && line.level === 'FATAL')
	);
}

function matchesSearch(line: FormattedLogLine, searchQuery: string, regex: RegExp | null): boolean {
	if (!searchQuery) return true;
	if (regex) return regex.test(line.msg) || regex.test(line.level);

	const query = searchQuery.toLowerCase();
	return line.msg.toLowerCase().includes(query) || line.level.toLowerCase().includes(query);
}

export function filterFormattedLogs(
	formattedLogs: FormattedLogLine[],
	{ levelFilter, searchQuery, regex }: LogFilterOptions
): FormattedLogLine[] {
	return formattedLogs.filter(
		(line) => matchesLevel(line, levelFilter) && matchesSearch(line, searchQuery, regex)
	);
}
