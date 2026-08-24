import { describe, expect, test, vi } from 'vitest';
import {
	loadResourceDiff,
	requestResourceDiff
} from '../routes/resources/[type]/[namespace]/[name]/diff-request.js';

describe('requestResourceDiff', () => {
	test('passes the abort signal and returns successful diff data', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(
				new Response(JSON.stringify({ diffs: [], timestamp: 123 }), { status: 200 })
			);
		const signal = new AbortController().signal;

		await expect(
			requestResourceDiff('http://localhost/diff?force=true', signal, fetcher)
		).resolves.toEqual({
			response: { diffs: [], timestamp: 123 }
		});
		expect(fetcher).toHaveBeenCalledWith('http://localhost/diff?force=true', { signal });
	});

	test('returns structured API errors', async () => {
		const fetcher = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ code: 'NotReady', message: 'Source pending' }), {
				status: 400,
				statusText: 'Bad Request'
			})
		);

		await expect(
			requestResourceDiff('http://localhost/diff', new AbortController().signal, fetcher)
		).resolves.toEqual({
			error: { code: 'NotReady', message: 'Source pending' }
		});
	});

	test('uses status text when an error response is not JSON', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(new Response('failure', { status: 500, statusText: 'Server Error' }));

		await expect(
			requestResourceDiff('http://localhost/diff', new AbortController().signal, fetcher)
		).resolves.toEqual({
			error: { code: undefined, message: 'Server Error' }
		});
	});

	test('adds force refresh and normalizes network failures', async () => {
		const fetcher = vi.fn().mockRejectedValue(new Error('Network unavailable'));
		await expect(
			loadResourceDiff('http://localhost/diff', true, new AbortController().signal, fetcher)
		).resolves.toEqual({ error: { code: undefined, message: 'Network unavailable' } });
		expect(fetcher).toHaveBeenCalledWith('http://localhost/diff?force=true', {
			signal: expect.any(AbortSignal)
		});
	});

	test('identifies aborted requests separately', async () => {
		const abortError = new Error('aborted');
		abortError.name = 'AbortError';
		const fetcher = vi.fn().mockRejectedValue(abortError);
		await expect(
			loadResourceDiff('http://localhost/diff', false, new AbortController().signal, fetcher)
		).resolves.toEqual({ aborted: true });
	});
});
