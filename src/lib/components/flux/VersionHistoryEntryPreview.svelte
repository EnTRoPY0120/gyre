<script lang="ts">
	import type { ReconciliationEntry } from '$lib/types/reconciliation';

	let {
		entry,
		expanded,
		onToggle
	}: {
		entry: ReconciliationEntry;
		expanded: boolean;
		onToggle: () => void;
	} = $props();
</script>

{#if entry.readyReason || entry.readyMessage || entry.errorMessage}
	<p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
		{#if entry.readyReason}
			<span class="font-medium">{entry.readyReason}:</span>
		{/if}
		{#if entry.readyMessage}
			{entry.readyMessage?.substring(0, 100)}
		{/if}
		{#if entry.errorMessage && !entry.readyMessage}
			<span class="text-red-600 dark:text-red-400">{entry.errorMessage.substring(0, 100)}</span>
		{/if}
		{#if (entry.readyMessage && entry.readyMessage.length > 100) || entry.errorMessage}
			<button
				onclick={onToggle}
				class="ml-1 text-primary hover:underline"
				aria-label="Toggle message details"
			>
				{expanded ? 'less' : 'more'}
			</button>
		{/if}
	</p>
{/if}
