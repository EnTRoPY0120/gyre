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

export interface ResourceDiff {
	kind: string;
	name: string;
	namespace: string;
	desired: string;
	live: string | null;
	error?: string;
}

export interface DiffResponse {
	diffs: ResourceDiff[];
	timestamp?: number;
	revision?: string | null;
}

export interface ReconciliationEntry {
	id: string;
	revision: string | null;
	status: 'success' | 'failure' | 'unknown';
	readyStatus: string | null;
	readyReason: string | null;
	readyMessage: string | null;
	reconcileCompletedAt: string;
	durationMs: number | null;
	triggerType: 'automatic' | 'manual' | 'webhook' | 'rollback';
	errorMessage: string | null;
	specSnapshot: string | null;
}
