import { describe, expect, test, vi } from 'vitest';
import {
	executeResourceAction,
	postResourceAction
} from '../lib/components/flux/resource-action.js';

const request = {
	type: 'GitRepository',
	namespace: 'flux system',
	name: 'source/app',
	action: 'reconcile' as const,
	csrfToken: 'csrf-token'
};

describe('postResourceAction', () => {
	test('encodes resource identity and sends the CSRF token', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

		await expect(postResourceAction(request, fetcher)).resolves.toBeUndefined();
		expect(fetcher).toHaveBeenCalledWith(
			'/api/v1/flux/GitRepository/flux%20system/source%2Fapp/reconcile',
			{ method: 'POST', headers: { 'X-CSRF-Token': 'csrf-token' } }
		);
	});

	test('surfaces the endpoint message for failed requests', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(
				new Response(JSON.stringify({ message: 'Resource is suspended' }), { status: 409 })
			);

		await expect(postResourceAction(request, fetcher)).rejects.toThrow('Resource is suspended');
	});

	test('uses a stable fallback for non-JSON failed requests', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response('failure', { status: 500 }));

		await expect(postResourceAction(request, fetcher)).rejects.toThrow(
			'Failed to reconcile resource'
		);
	});

	test('executes mutation and refresh without scheduling a retry on success', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
		const invalidate = vi.fn().mockResolvedValue(undefined);
		const scheduleRetry = vi.fn();

		await expect(
			executeResourceAction(request, 'flux:resource:key', invalidate, scheduleRetry, fetcher)
		).resolves.toEqual({ mutationError: null, invalidateError: null });
		expect(invalidate).toHaveBeenCalledWith('flux:resource:key');
		expect(scheduleRetry).not.toHaveBeenCalled();
	});

	test('returns mutation errors without refreshing', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(
				new Response(JSON.stringify({ message: 'Mutation failed' }), { status: 500 })
			);
		const invalidate = vi.fn();

		const result = await executeResourceAction(request, 'key', invalidate, vi.fn(), fetcher);

		expect(result.mutationError?.message).toBe('Mutation failed');
		expect(result.invalidateError).toBeNull();
		expect(invalidate).not.toHaveBeenCalled();
	});

	test('returns refresh errors and schedules a retry callback', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
		const invalidate = vi.fn().mockRejectedValue(new Error('Refresh failed'));
		const scheduleRetry = vi.fn();

		const result = await executeResourceAction(request, 'key', invalidate, scheduleRetry, fetcher);

		expect(result).toMatchObject({
			mutationError: null,
			invalidateError: new Error('Refresh failed')
		});
		expect(scheduleRetry).toHaveBeenCalledWith(expect.any(Function));
	});
});
