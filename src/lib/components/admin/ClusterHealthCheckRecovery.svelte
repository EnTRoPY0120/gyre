<script lang="ts">
	import type { ClusterRecoverySummary, ClusterRecoverySummaryAction } from '$lib/clusters/recovery';
	import Button from '$lib/components/ui/button/button.svelte';

	let {
		summary,
		errorSummary,
		onAction
	}: {
		summary: ClusterRecoverySummary;
		errorSummary: string | null;
		onAction: (action: Extract<ClusterRecoverySummaryAction, { action: string }>['action']) => void;
	} = $props();
</script>

<div class="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
	<div class="flex flex-col gap-4">
		<div>
			<p class="text-sm font-semibold text-red-300">{summary.title}</p>
			<p class="mt-1 text-sm text-slate-200">{summary.description}</p>
			{#if errorSummary}
				<p class="mt-3 rounded-lg bg-slate-900/50 p-3 text-xs text-slate-300">{errorSummary}</p>
			{/if}
		</div>
		<div class="space-y-2">
			{#each summary.guidance as item, index (index)}
				<p class="text-sm text-slate-300">• {item}</p>
			{/each}
		</div>
		<div class="flex flex-wrap gap-2">
			{#each summary.actions as action (action.label)}
				{#if 'href' in action}
					<a
						href={action.href}
						class="inline-flex items-center rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
					>
						{action.label}
					</a>
				{:else if 'action' in action}
					<Button
						type="button"
						variant={action.action === 'retest' ? 'default' : 'outline'}
						onclick={() => onAction(action.action)}
					>
						{action.label}
					</Button>
				{/if}
			{/each}
		</div>
	</div>
</div>
