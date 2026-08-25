import { describe, expect, test } from 'vitest';
import {
	filterFormattedLogs,
	getLogRegexState,
	type LogFilterOptions
} from '../lib/components/resources/tabs/logs-tab-filters.js';
import { formatLogLine } from '../lib/components/resources/log-formatting.js';
import type { FormattedLogLine } from '../lib/components/resources/tabs/logs-tab-types.js';

const lines: FormattedLogLine[] = [
	{ timestamp: '10:00:00', level: 'INFO', msg: 'reconciliation complete' },
	{ timestamp: '10:00:01', level: 'WARNING', msg: 'retrying request' },
	{ timestamp: '10:00:02', level: 'FATAL', msg: 'cluster unavailable' }
];

function filterOptions(overrides: Partial<LogFilterOptions> = {}): LogFilterOptions {
	return {
		levelFilter: 'ALL',
		searchQuery: '',
		useRegex: false,
		regex: null,
		...overrides
	};
}

describe('getLogRegexState', () => {
	test('returns no pattern state when regex search is disabled or empty', () => {
		expect(getLogRegexState('', false)).toEqual({ regex: null, error: null });
		expect(getLogRegexState('warning', false)).toEqual({ regex: null, error: null });
	});

	test('compiles valid patterns and reports invalid patterns', () => {
		expect(getLogRegexState('retry|cluster', true)).toEqual({
			regex: /retry|cluster/i,
			error: null
		});
		expect(getLogRegexState('[', true)).toEqual({
			regex: null,
			error: 'Invalid regular expression'
		});
	});

	test('rejects patterns with catastrophic backtracking risk', () => {
		expect(getLogRegexState(['(', 'a+', ')+$'].join(''), true)).toEqual({
			regex: null,
			error: 'Pattern may cause performance issues'
		});
	});
});

describe('filterFormattedLogs', () => {
	test('combines level aliases and case-insensitive text search', () => {
		expect(
			filterFormattedLogs(lines, filterOptions({ levelFilter: 'WARN', searchQuery: 'RETRY' }))
		).toEqual([lines[1]]);
		expect(filterFormattedLogs(lines, filterOptions({ levelFilter: 'ERROR' }))).toEqual([lines[2]]);
	});

	test('matches regular expressions against messages and levels', () => {
		const regex = getLogRegexState('fatal|retry', true).regex;
		expect(
			filterFormattedLogs(
				lines,
				filterOptions({ useRegex: true, searchQuery: 'fatal|retry', regex })
			)
		).toEqual([lines[1], lines[2]]);
	});

	test('returns no regex matches when the pattern is unsafe or invalid', () => {
		expect(
			filterFormattedLogs(lines, filterOptions({ useRegex: true, searchQuery: '[', regex: null }))
		).toEqual([]);
	});
});

describe('formatLogLine', () => {
	test('normalizes structured log messages and levels', () => {
		expect(formatLogLine('{"level":"warn","message":"retrying"}')).toMatchObject({
			level: 'WARN',
			msg: 'retrying'
		});
	});

	test('preserves malformed lines as informational text', () => {
		expect(formatLogLine('{')).toEqual({ ts: '', level: 'INFO', msg: '{', full: '{' });
	});
});
