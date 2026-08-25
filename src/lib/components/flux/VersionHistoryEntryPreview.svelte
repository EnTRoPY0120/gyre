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

	let hasPreview = $derived(Boolean(entry.readyReason || entry.readyMessage || entry.errorMessage));
	let readyMessagePreview = $derived(entry.readyMessage?.substring(0, 100));
	let errorMessagePreview = $derived(
		!entry.readyMessage ? entry.errorMessage?.substring(0, 100) : undefined
	);
	let showToggle = $derived(Boolean((entry.readyMessage?.length ?? 0) > 100 || entry.errorMessage));
</script>

{#if hasPreview}
	<p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
		{#if entry.readyReason}
			<span class="font-medium">{entry.readyReason}:</span>
		{/if}
		{#if readyMessagePreview}
			{readyMessagePreview}
		{/if}
		{#if errorMessagePreview}
			<span class="text-red-600 dark:text-red-400">{errorMessagePreview}</span>
		{/if}
		{#if showToggle}
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
