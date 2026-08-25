import type { HealthCheckResult } from '$lib/server/clusters';
import { getRecoverySummaryForCheck } from './recovery-guidance';

export type ClusterRecoverySummaryAction =
	| {
			label: string;
			href: string;
			action?: never;
	  }
	| {
			label: string;
			action: 'openCreateModal' | 'retest';
			href?: never;
	  };

export interface ClusterRecoverySummary {
	title: string;
	description: string;
	guidance: string[];
	actions: ClusterRecoverySummaryAction[];
}

function getFirstFailingHealthCheck(checks: HealthCheckResult[]): HealthCheckResult | undefined {
	return checks.find((check) => !check.passed);
}

export function deriveClusterRecoverySummary(
	checks: HealthCheckResult[]
): ClusterRecoverySummary | null {
	const failingCheck = getFirstFailingHealthCheck(checks);
	return failingCheck ? getRecoverySummaryForCheck(failingCheck.name) : null;
}
