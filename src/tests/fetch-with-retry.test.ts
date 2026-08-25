import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fetchWithRetry } from '../lib/utils/fetch.js';

beforeEach(() => {
	vi.useRealTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

function response(status: number): Response {
	return new Response(null, { status });
}

describe('fetchWithRetry', () => {
	test('returns successful responses without retrying', async () => {
		const fetchFn = vi.fn().mockResolvedValue(response(200));
		const warn = vi.fn();

		const result = await fetchWithRetry('/health', undefined, { fetchFn, logger: { warn } });

		expect(result.status).toBe(200);
		expect(fetchFn).toHaveBeenCalledOnce();
		expect(warn).not.toHaveBeenCalled();
	});

	test('retries retryable responses and returns the later response', async () => {
		const fetchFn = vi.fn().mockResolvedValueOnce(response(503)).mockResolvedValue(response(200));
		const warn = vi.fn();

		const result = await fetchWithRetry('/health', undefined, {
			maxRetries: 1,
			initialDelay: 0,
			fetchFn,
			logger: { warn }
		});

		expect(result.status).toBe(200);
		expect(fetchFn).toHaveBeenCalledTimes(2);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('status 503'));
	});

	test('retries network failures and throws the final error', async () => {
		const failure = new Error('network unavailable');
		const fetchFn = vi.fn().mockRejectedValue(failure);
		const warn = vi.fn();

		await expect(
			fetchWithRetry('/health', undefined, {
				maxRetries: 1,
				initialDelay: 0,
				fetchFn,
				logger: { warn }
			})
		).rejects.toBe(failure);

		expect(fetchFn).toHaveBeenCalledTimes(2);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('network error'));
	});

	test('returns the final retryable response after exhausting retries', async () => {
		const fetchFn = vi.fn().mockResolvedValue(response(504));

		const result = await fetchWithRetry('/health', undefined, {
			maxRetries: 1,
			initialDelay: 0,
			fetchFn,
			logger: { warn: vi.fn() }
		});

		expect(result.status).toBe(504);
		expect(fetchFn).toHaveBeenCalledTimes(2);
	});
});
