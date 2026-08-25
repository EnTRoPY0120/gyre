import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
	getDashboardCache,
	getDashboardCacheKey,
	invalidateDashboardCache,
	setDashboardCache
} from '../lib/server/dashboard-cache.js';

describe('dashboard cache', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
		invalidateDashboardCache();
	});

	afterEach(() => {
		invalidateDashboardCache();
		vi.useRealTimers();
	});

	test('builds stable keys and returns cached data until it expires', () => {
		const key = getDashboardCacheKey({ userId: 'user-1', role: 'admin', clusterId: 'cluster-1' });
		setDashboardCache(key, { ready: true });

		expect(key).toBe('dashboard:user:user-1:role:admin:cluster:cluster-1');
		expect(getDashboardCache(key)).toEqual({ ready: true });

		vi.advanceTimersByTime(30_000);

		expect(getDashboardCache(key)).toBeNull();
	});

	test('updates existing entries without evicting another entry', () => {
		setDashboardCache('first', 'old');
		setDashboardCache('second', 'second');

		setDashboardCache('first', 'updated');

		expect(getDashboardCache('first')).toBe('updated');
		expect(getDashboardCache('second')).toBe('second');
	});

	test('evicts the oldest entry when a new entry exceeds the cache limit', () => {
		for (let index = 0; index < 50; index += 1) {
			setDashboardCache(`entry-${index}`, index);
			vi.advanceTimersByTime(1);
		}

		setDashboardCache('entry-50', 50);

		expect(getDashboardCache('entry-0')).toBeNull();
		expect(getDashboardCache('entry-1')).toBe(1);
		expect(getDashboardCache('entry-50')).toBe(50);
	});

	test('invalidates all entries or only entries for a cluster', () => {
		setDashboardCache('dashboard:cluster:cluster-1', 'one');
		setDashboardCache('dashboard:cluster:cluster-2', 'two');

		invalidateDashboardCache('cluster-1');

		expect(getDashboardCache('dashboard:cluster:cluster-1')).toBeNull();
		expect(getDashboardCache('dashboard:cluster:cluster-2')).toBe('two');

		invalidateDashboardCache();

		expect(getDashboardCache('dashboard:cluster:cluster-2')).toBeNull();
	});
});
