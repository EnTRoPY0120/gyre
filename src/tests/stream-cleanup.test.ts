import { describe, expect, test, vi } from 'vitest';
import { createSseCleanup } from '../routes/api/v1/events/stream-cleanup.js';

describe('createSseCleanup', () => {
	test('releases, unsubscribes, clears the timer, and closes only once', () => {
		const release = vi.fn();
		const unsubscribe = vi.fn();
		const clearTimer = vi.fn();
		const close = vi.fn();
		const cleanup = createSseCleanup({ release, close, clearTimer });
		cleanup.setUnsubscribe(unsubscribe);
		cleanup.setTimeoutHandle(42 as ReturnType<typeof setTimeout>);

		cleanup.cleanup();
		cleanup.cleanup();

		expect(release).toHaveBeenCalledOnce();
		expect(unsubscribe).toHaveBeenCalledOnce();
		expect(clearTimer).toHaveBeenCalledWith(42);
		expect(close).toHaveBeenCalledOnce();
	});

	test('ignores an already-closed stream', () => {
		const cleanup = createSseCleanup({
			release: vi.fn(),
			close: () => {
				throw new Error('already closed');
			}
		});

		expect(() => cleanup.cleanup()).not.toThrow();
	});
});
