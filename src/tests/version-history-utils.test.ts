import { describe, expect, test } from 'vitest';
import {
	formatDurationMs,
	getStatusBadgeClass,
	getStatusDotClass,
	getTriggerBadgeClass
} from '../lib/components/flux/version-history-utils.js';

describe('version history presentation helpers', () => {
	test('maps reconciliation statuses to dot and badge classes', () => {
		expect(getStatusDotClass('success')).toContain('bg-green-500');
		expect(getStatusDotClass('failure')).toContain('bg-red-500');
		expect(getStatusDotClass('unknown')).toContain('bg-gray-400');
		expect(getStatusBadgeClass('success')).toContain('text-green-700');
		expect(getStatusBadgeClass('failure')).toContain('text-red-700');
		expect(getStatusBadgeClass('unknown')).toContain('text-gray-700');
	});

	test('maps non-automatic triggers to their badge classes', () => {
		expect(getTriggerBadgeClass('manual')).toContain('text-blue-700');
		expect(getTriggerBadgeClass('webhook')).toContain('text-purple-700');
		expect(getTriggerBadgeClass('rollback')).toContain('text-amber-700');
		expect(getTriggerBadgeClass('automatic')).toContain('text-gray-700');
	});

	test('formats durations and handles missing values', () => {
		expect(formatDurationMs(null)).toBe('N/A');
		expect(formatDurationMs(0)).toBe('0ms');
		expect(formatDurationMs(65_000)).toBe('1 minute 5 seconds');
	});
});
