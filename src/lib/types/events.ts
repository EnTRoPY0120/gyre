export interface K8sInvolvedObject {
	kind: string;
	name: string;
	namespace: string;
	uid: string;
	apiVersion?: string;
	resourceVersion?: string;
	fieldPath?: string;
}

export interface K8sEvent {
	type: 'Normal' | 'Warning';
	reason: string;
	message: string;
	count: number;
	firstTimestamp: string | null;
	lastTimestamp: string | null;
	involvedObject: K8sInvolvedObject;
	source: {
		component: string;
	};
}
