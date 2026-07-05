import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { importFresh } from './helpers/import-fresh';

vi.spyOn(console, 'log').mockImplementation(() => {});

type AuditModule = typeof import('../lib/server/audit.js');
let scheduleAuditLogCleanup: AuditModule['scheduleAuditLogCleanup'];
import { getCutoffDate, getRandomJitterMs, MS_PER_DAY } from '../lib/server/utils/time.js';

beforeEach(async () => {
	const auditModule = await importFresh<AuditModule>('../lib/server/audit.js');
	scheduleAuditLogCleanup = auditModule.scheduleAuditLogCleanup;
});

afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.resetModules();
});

// ---------------------------------------------------------------------------
// Scheduler Tests
// ---------------------------------------------------------------------------

describe('Audit Log Scheduler', () => {
	test('scheduleAuditLogCleanup sets up timeouts', () => {
		vi.useFakeTimers();
		const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

		scheduleAuditLogCleanup();

		// Should have set up initialDelayTimeout and immediateCleanupTimeout
		expect(setTimeoutSpy).toHaveBeenCalled();

		setTimeoutSpy.mockRestore();
	});

	test('scheduleAuditLogCleanup is idempotent', () => {
		vi.useFakeTimers();
		const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

		scheduleAuditLogCleanup();
		scheduleAuditLogCleanup();

		expect(setTimeoutSpy).toHaveBeenCalledTimes(2);

		setTimeoutSpy.mockRestore();
	});
});

// ---------------------------------------------------------------------------
// Time Utilities Tests
// ---------------------------------------------------------------------------

describe('Time Utilities', () => {
	test('getCutoffDate returns a date in the past', () => {
		const retentionDays = 30;
		const cutoff = getCutoffDate(retentionDays);
		const now = new Date();

		// Should be approximately retentionDays ago
		const diffMs = now.getTime() - cutoff.getTime();
		const diffDays = diffMs / MS_PER_DAY;

		expect(diffDays).toBeGreaterThanOrEqual(29.9);
		expect(diffDays).toBeLessThanOrEqual(30.1);
	});

	test('getRandomJitterMs returns value within range', () => {
		const maxMinutes = 30;
		const jitter = getRandomJitterMs(maxMinutes);

		expect(jitter).toBeGreaterThanOrEqual(0);
		expect(jitter).toBeLessThanOrEqual(maxMinutes * 60 * 1000);
	});
});
