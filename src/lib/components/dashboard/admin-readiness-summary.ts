import type { AdminReadinessSummary } from '$lib/types/admin-readiness';

function formatStepSummary(count: number, singularVerb: string, pluralVerb: string): string {
	const noun = count === 1 ? 'step' : 'steps';
	const verb = count === 1 ? singularVerb : pluralVerb;
	return `${count} ${noun} ${verb}`;
}

/** Return the concise status sentence shown above the readiness checklist. */
export function getReadinessSummaryText(summary: AdminReadinessSummary): string {
	if (summary.actionRequiredCount > 0) {
		return `${formatStepSummary(summary.actionRequiredCount, 'requires', 'require')} action now.`;
	}
	if (summary.attentionCount > 0) {
		return `${formatStepSummary(summary.attentionCount, 'needs', 'need')} attention.`;
	}
	return 'All readiness checks are healthy.';
}
