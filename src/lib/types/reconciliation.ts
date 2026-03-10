export type ReadyStatus = 'True' | 'False' | 'Unknown';

export interface ReconciliationEntry {
	id: string;
	revision: string | null;
	status: 'success' | 'failure' | 'unknown';
	readyStatus: ReadyStatus | null;
	readyReason: string | null;
	readyMessage: string | null;
	reconcileCompletedAt: string;
	durationMs: number | null;
	triggerType: 'automatic' | 'manual' | 'webhook' | 'rollback';
	errorMessage: string | null;
	specSnapshot: string | null;
}
