import { describe, expect, test } from 'vitest';
import { getReadinessSummaryText } from '../lib/components/dashboard/admin-readiness-summary.js';

function summary(overrides: Partial<Parameters<typeof getReadinessSummaryText>[0]> = {}) {
	return {
		status: 'ready' as const,
		readyCount: 0,
		attentionCount: 0,
		actionRequiredCount: 0,
		steps: [],
		...overrides
	};
}

describe('getReadinessSummaryText', () => {
	test('reports singular and plural action-required steps', () => {
		expect(getReadinessSummaryText(summary({ actionRequiredCount: 1 }))).toBe(
			'1 step requires action now.'
		);
		expect(getReadinessSummaryText(summary({ actionRequiredCount: 2 }))).toBe(
			'2 steps require action now.'
		);
	});

	test('reports attention before the healthy fallback', () => {
		expect(getReadinessSummaryText(summary({ attentionCount: 1 }))).toBe('1 step needs attention.');
		expect(getReadinessSummaryText(summary({ attentionCount: 2 }))).toBe('2 steps need attention.');
		expect(getReadinessSummaryText(summary())).toBe('All readiness checks are healthy.');
	});
});
