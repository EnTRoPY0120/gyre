export type AdminReadinessStatus = 'ready' | 'attention' | 'action-required';

export type AdminReadinessStepId =
	| 'cluster-connectivity'
	| 'auth-access'
	| 'backup-encryption'
	| 'backup-verification';

export interface AdminReadinessStep {
	id: AdminReadinessStepId;
	title: string;
	description: string;
	status: AdminReadinessStatus;
	href: string;
	ctaLabel: string;
}

export interface AdminReadinessSummary {
	status: AdminReadinessStatus;
	readyCount: number;
	attentionCount: number;
	actionRequiredCount: number;
	steps: AdminReadinessStep[];
}
