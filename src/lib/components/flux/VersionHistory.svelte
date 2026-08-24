<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { ReconciliationEntry } from '$lib/types/reconciliation';
	import VersionHistoryEntry from './VersionHistoryEntry.svelte';

	let {
		timeline = [],
		loading = false,
		onRollback
	}: {
		timeline: ReconciliationEntry[];
		loading?: boolean;
		onRollback?: (historyId: string, revision: string | null) => void;
	} = $props();

	// Filter state
	let filterStatus = $state<'all' | 'success' | 'failure'>('all');
	let expandedEntries = new SvelteSet<string>();

	const filteredTimeline = $derived(
		filterStatus === 'all' ? timeline : timeline.filter((e) => e.status === filterStatus)
	);

	const successCount = $derived(timeline.filter((e) => e.status === 'success').length);
	const failureCount = $derived(timeline.filter((e) => e.status === 'failure').length);

	function toggleExpand(id: string) {
		if (expandedEntries.has(id)) {
			expandedEntries.delete(id);
		} else {
			expandedEntries.add(id);
		}
	}

</script>

<div class="space-y-4">
	<!-- Filter Tabs -->
	<div class="flex items-center gap-2">
		<button
			type="button"
			class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors {filterStatus === 'all'
				? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
				: 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}"
			onclick={() => (filterStatus = 'all')}
			aria-label="Show all reconciliation events"
		>
			All ({timeline.length})
		</button>
		<button
			type="button"
			class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors {filterStatus === 'success'
				? 'bg-green-600 text-white'
				: 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50'}"
			onclick={() => (filterStatus = 'success')}
			aria-label="Show successful reconciliations"
		>
			Success ({successCount})
		</button>
		<button
			type="button"
			class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors {filterStatus === 'failure'
				? 'bg-red-600 text-white'
				: 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50'}"
			onclick={() => (filterStatus = 'failure')}
			aria-label="Show failed reconciliations"
		>
			Failed ({failureCount})
		</button>
	</div>

	<!-- Loading State -->
	{#if loading}
		<div class="flex justify-center py-12">
			<div
				class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
				aria-label="Loading reconciliation timeline"
			></div>
		</div>
	{:else if filteredTimeline.length === 0}
		<!-- Empty State -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<svg
				class="h-12 w-12 text-gray-300 dark:text-gray-600"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<p class="mt-4 text-sm text-gray-500 dark:text-gray-400">
				{filterStatus === 'all'
					? 'No reconciliation history found for this resource'
					: `No ${filterStatus} reconciliations`}
			</p>
		</div>
	{:else}
		<!-- Timeline -->
		<div class="relative space-y-4">
			{#each filteredTimeline as entry, i (entry.id)}
				<VersionHistoryEntry
					{entry}
					index={i}
					total={filteredTimeline.length}
					expanded={expandedEntries.has(entry.id)}
					onToggle={() => toggleExpand(entry.id)}
					{onRollback}
				/>
			{/each}
		</div>
	{/if}
</div>
