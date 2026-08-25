<script lang="ts">
	import { cn } from '$lib/utils';
	import type { ReconciliationEntry } from '$lib/types/reconciliation';
	import {
		formatDurationMs,
		getStatusBadgeClass,
		getTriggerBadgeClass
	} from './version-history-utils';

	let {
		entry,
		isCurrent
	}: {
		entry: ReconciliationEntry;
		isCurrent: boolean;
	} = $props();
</script>

<div class="flex flex-wrap items-center gap-2">
	{#if isCurrent}
		<span
			class="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
		>
			CURRENT
		</span>
	{/if}

	<span
		class={cn(
			'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
			getStatusBadgeClass(entry.status)
		)}
	>
		{entry.status.toUpperCase()}
	</span>

	{#if entry.triggerType !== 'automatic'}
		<span
			class={cn(
				'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
				getTriggerBadgeClass(entry.triggerType)
			)}
		>
			{entry.triggerType.toUpperCase()}
		</span>
	{/if}

	{#if entry.revision}
		<span class="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
			{entry.revision.slice(0, 8)}
		</span>
	{/if}

	{#if entry.durationMs !== undefined && entry.durationMs !== null}
		<span class="text-xs text-gray-500 dark:text-gray-400">
			{formatDurationMs(entry.durationMs)}
		</span>
	{/if}
</div>
