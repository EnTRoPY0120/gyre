import { describe, expect, test, vi } from 'vitest';
import { flushSseEventQueue } from '../routes/api/v1/events/sse-queue.js';

function createController(
	desiredSize: number | null,
	enqueue: (event: Uint8Array) => void
): ReadableStreamDefaultController<Uint8Array> {
	return { desiredSize, enqueue } as unknown as ReadableStreamDefaultController<Uint8Array>;
}

describe('flushSseEventQueue', () => {
	test('drains queued events while the stream has capacity', () => {
		const first = new Uint8Array([1]);
		const second = new Uint8Array([2]);
		const received: Uint8Array[] = [];

		flushSseEventQueue(
			[first, second],
			createController(1, (event) => received.push(event)),
			vi.fn()
		);

		expect(received).toEqual([first, second]);
	});

	test('leaves queued events in place when backpressure is applied', () => {
		const queued = [new Uint8Array([1])];
		const enqueue = vi.fn();

		flushSseEventQueue(queued, createController(0, enqueue), vi.fn());

		expect(enqueue).not.toHaveBeenCalled();
		expect(queued).toHaveLength(1);
	});

	test('runs cleanup when the stream rejects an enqueue', () => {
		const cleanup = vi.fn();
		const queued = [new Uint8Array([1])];

		flushSseEventQueue(
			queued,
			createController(1, () => {
				throw new Error('stream closed');
			}),
			cleanup
		);

		expect(cleanup).toHaveBeenCalledOnce();
		expect(queued).toHaveLength(0);
	});
});
