<script lang="ts">
	import { cn } from '$lib/utils';
	import type { ReconciliationEntry } from '$lib/types/reconciliation';
	import VersionHistoryEntryActions from './VersionHistoryEntryActions.svelte';
	import VersionHistoryEntryHeader from './VersionHistoryEntryHeader.svelte';
	import VersionHistoryEntryMessage from './VersionHistoryEntryMessage.svelte';
	import { getStatusDotClass } from './version-history-utils';

	let {
		entry,
		index,
		total,
		expanded = false,
		onToggle,
		onRollback
	}: {
		entry: ReconciliationEntry;
		index: number;
		total: number;
		expanded?: boolean;
		onToggle: () => void;
		onRollback?: (historyId: string, revision: string | null) => void;
	} = $props();
</script>

<div class="relative flex gap-4">
	<!-- Timeline Line & Dot -->
	<div class="relative flex flex-col items-center">
		<div
			class={cn(
				'h-3 w-3 rounded-full ring-4 ring-white dark:ring-gray-900',
				getStatusDotClass(entry.status)
			)}
			aria-hidden="true"
		></div>
		{#if index < total - 1}
			<div class="h-full w-0.5 flex-1 bg-gray-200 dark:bg-gray-700" aria-hidden="true"></div>
		{/if}
	</div>

	<!-- Event Card -->
	<div
		class={cn(
			'flex-1 rounded-lg border p-4 transition-all',
			entry.status === 'failure'
				? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10'
				: 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
			'hover:border-primary/30'
		)}
	>
		<div class="flex items-start justify-between gap-4">
			<div class="flex-1">
				<VersionHistoryEntryHeader {entry} isCurrent={index === 0} />
				<VersionHistoryEntryMessage {entry} {expanded} {onToggle} />
			</div>

			<VersionHistoryEntryActions {entry} {index} {onRollback} />
		</div>
	</div>
</div>
