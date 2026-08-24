export interface K8sEvent {
	type: 'Normal' | 'Warning';
	reason: string;
	message: string;
	count: number;
	firstTimestamp: string | null;
	lastTimestamp: string | null;
	source: {
		component: string;
	};
}

export type EventFilter = 'all' | 'Normal' | 'Warning';
