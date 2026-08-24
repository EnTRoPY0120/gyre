export interface EventSourceHandlers {
	onOpen: (source: EventSource) => void;
	onMessage: (source: EventSource, event: MessageEvent) => void;
	onError: (source: EventSource) => void;
}

export type EventSourceConstructor = new (url: string) => EventSource;

/** Create an EventSource and forward callbacks with the source identity attached. */
export function createEventSource(
	url: string,
	handlers: EventSourceHandlers,
	EventSourceClass: EventSourceConstructor = EventSource
): EventSource {
	const source = new EventSourceClass(url);
	source.onopen = () => handlers.onOpen(source);
	source.onmessage = (event) => handlers.onMessage(source, event);
	source.onerror = () => handlers.onError(source);
	return source;
}
