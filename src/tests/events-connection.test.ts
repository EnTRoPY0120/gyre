import { describe, expect, test, vi } from 'vitest';
import { createEventSource, type EventSourceConstructor } from '../lib/stores/events/connection.js';

class FakeEventSource {
	onopen: (() => void) | null = null;
	onmessage: ((event: MessageEvent) => void) | null = null;
	onerror: (() => void) | null = null;
	url: string;

	constructor(url: string) {
		this.url = url;
	}
}

describe('createEventSource', () => {
	test('attaches handlers and preserves the source identity', () => {
		const onOpen = vi.fn();
		const onMessage = vi.fn();
		const onError = vi.fn();
		const source = createEventSource(
			'/api/v1/events',
			{ onOpen, onMessage, onError },
			FakeEventSource as unknown as EventSourceConstructor
		) as unknown as FakeEventSource;
		const message = new MessageEvent('message', { data: '{"type":"ADDED"}' });

		source.onopen?.();
		source.onmessage?.(message);
		source.onerror?.();

		expect(source.url).toBe('/api/v1/events');
		expect(onOpen).toHaveBeenCalledWith(source);
		expect(onMessage).toHaveBeenCalledWith(source, message);
		expect(onError).toHaveBeenCalledWith(source);
	});
});
