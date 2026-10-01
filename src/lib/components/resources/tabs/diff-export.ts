import type { ResourceDiff } from '$lib/types/resource';

export function formatDiffExport(diffs: ResourceDiff[]): string {
	return diffs
		.map(
			(diff) =>
				`--- ${diff.kind}/${diff.name} (${diff.namespace}) ---\n${diff.error ? `Preview failed: ${diff.error}\n\n` : ''}Desired:\n${diff.desired}\n\nLive:\n${diff.live || 'None'}\n`
		)
		.join('\n');
}
