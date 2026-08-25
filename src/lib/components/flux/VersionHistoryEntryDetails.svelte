<script lang="ts">
	import type { ReconciliationEntry } from '$lib/types/reconciliation';

	let {
		entry,
		expanded
	}: {
		entry: ReconciliationEntry;
		expanded: boolean;
	} = $props();
</script>

{#if expanded}
	<div class="mt-3 space-y-2 rounded-md bg-gray-50 p-3 dark:bg-gray-900/50">
		{#if entry.readyMessage}
			<div>
				<p class="text-xs font-medium text-gray-500 dark:text-gray-400">Message:</p>
				<p class="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
					{entry.readyMessage}
				</p>
			</div>
		{/if}
		{#if entry.errorMessage}
			<div>
				<p class="text-xs font-medium text-red-500 dark:text-red-400">Error:</p>
				<p class="mt-1 whitespace-pre-wrap text-sm text-red-700 dark:text-red-300">
					{entry.errorMessage}
				</p>
			</div>
		{/if}
	</div>
{/if}
