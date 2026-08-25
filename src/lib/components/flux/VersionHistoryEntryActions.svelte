<script lang="ts">
	import type { ReconciliationEntry } from '$lib/types/reconciliation';

	let {
		entry,
		index,
		onRollback
	}: {
		entry: ReconciliationEntry;
		index: number;
		onRollback?: (historyId: string, revision: string | null) => void;
	} = $props();
</script>

{#if index > 0 && onRollback && entry.specSnapshot}
	<button
		onclick={() => onRollback(entry.id, entry.revision)}
		class="text-sm font-medium text-primary transition-colors hover:text-primary/70"
		aria-label="Rollback to this revision"
	>
		Rollback
	</button>
{:else if index === 0}
	<span class="text-xs text-gray-400 dark:text-gray-500">Current</span>
{/if}
