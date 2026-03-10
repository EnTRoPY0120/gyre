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
