export interface AlertEventSource {
	kind: string;
	name: string;
	namespace?: string;
	matchLabels?: Record<string, string>;
}
