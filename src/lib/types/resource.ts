export type { K8sInvolvedObject, K8sEvent } from './events';
export type { ReconciliationEntry } from './reconciliation';

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
