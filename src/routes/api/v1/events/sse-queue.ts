export function flushSseEventQueue(
	eventQueue: Uint8Array[],
	controller: ReadableStreamDefaultController<Uint8Array>,
	onEnqueueFailure: () => void
): void {
	while (eventQueue.length > 0 && (controller.desiredSize ?? 1) > 0) {
		const event = eventQueue.shift();
		if (!event) return;

		try {
			controller.enqueue(event);
		} catch {
			onEnqueueFailure();
			return;
		}
	}
}
