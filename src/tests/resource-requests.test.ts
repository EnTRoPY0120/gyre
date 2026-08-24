import { describe, expect, test, vi } from 'vitest';
import {
	loadResourceEvents,
	loadResourceHistory,
	loadResourceLogs,
	requestResourceRollback
} from '../routes/resources/[type]/[namespace]/[name]/resource-requests.js';

describe('resource detail loaders', () => {
	test('loads events and history with the abort signal', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ events: [] }), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ timeline: [] }), { status: 200 }));
		const signal = new AbortController().signal;

		await expect(loadResourceEvents('/events', signal, fetcher)).resolves.toEqual({
			response: { events: [] }
		});
		await expect(loadResourceHistory('/history', signal, fetcher)).resolves.toEqual({
			response: { timeline: [] }
		});
		expect(fetcher).toHaveBeenNthCalledWith(1, '/events', { signal });
		expect(fetcher).toHaveBeenNthCalledWith(2, '/history', { signal });
	});

	test('normalizes event and history failures', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(new Response('', { status: 503, statusText: 'Unavailable' }))
			.mockRejectedValueOnce(new Error('Network unavailable'));

		await expect(
			loadResourceEvents('/events', new AbortController().signal, fetcher)
		).resolves.toEqual({ error: { message: 'Failed to fetch events: Unavailable' } });
		await expect(
			loadResourceHistory('/history', new AbortController().signal, fetcher)
		).resolves.toEqual({ error: { message: 'Network unavailable' } });
	});
});

describe('loadResourceLogs', () => {
	test('passes the abort signal and returns normalized logs', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify({ logs: 'line 1\nline 2' }), { status: 200 }));
		const signal = new AbortController().signal;

		await expect(loadResourceLogs('/logs', signal, fetcher)).resolves.toEqual({
			response: { logs: 'line 1\nline 2' }
		});
		expect(fetcher).toHaveBeenCalledWith('/logs', { signal });
	});

	test('returns API messages for failed JSON responses', async () => {
		const fetcher = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ message: 'Controller is unavailable' }), {
				status: 503,
				headers: { 'content-type': 'application/json' }
			})
		);

		await expect(loadResourceLogs('/logs', new AbortController().signal, fetcher)).resolves.toEqual(
			{
				error: { message: 'Controller is unavailable' }
			}
		);
	});

	test('uses a stable fallback for non-JSON failures', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(new Response('', { status: 500, statusText: 'Server Error' }));

		await expect(loadResourceLogs('/logs', new AbortController().signal, fetcher)).resolves.toEqual(
			{
				error: { message: 'Failed to fetch logs: Server Error' }
			}
		);
	});

	test('identifies aborted and network failures separately', async () => {
		const abortError = new Error('aborted');
		abortError.name = 'AbortError';
		await expect(
			loadResourceLogs('/logs', new AbortController().signal, vi.fn().mockRejectedValue(abortError))
		).resolves.toEqual({ aborted: true });

		await expect(
			loadResourceLogs(
				'/logs',
				new AbortController().signal,
				vi.fn().mockRejectedValue(new Error('Network unavailable'))
			)
		).resolves.toEqual({ error: { message: 'Network unavailable' } });
	});
});

describe('requestResourceRollback', () => {
	test('sends the rollback body and CSRF token', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
		const request = { historyId: 'history-1', revision: 'main@sha1:abc' };

		await expect(
			requestResourceRollback('/rollback', request, 'csrf-token', fetcher)
		).resolves.toBeUndefined();
		expect(fetcher).toHaveBeenCalledWith('/rollback', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'csrf-token' },
			body: JSON.stringify(request)
		});
	});

	test('surfaces rollback API errors', async () => {
		const fetcher = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ message: 'Revision no longer exists' }), {
				status: 409,
				headers: { 'content-type': 'application/json' }
			})
		);

		await expect(
			requestResourceRollback(
				'/rollback',
				{ historyId: 'history-1', revision: null },
				'csrf-token',
				fetcher
			)
		).rejects.toThrow('Revision no longer exists');
	});
});
