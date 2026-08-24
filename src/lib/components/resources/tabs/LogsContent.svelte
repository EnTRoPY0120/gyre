<script lang="ts">
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import TabStateMessage from './TabStateMessage.svelte';
	import VirtualList from '$lib/components/ui/VirtualList.svelte';
	import type { FormattedLogLine } from './logs-tab-types';

	let {
		logs,
		filteredFormattedLogs,
		loading,
		error,
		showRawLogs,
		onRefresh,
		logContainer = $bindable()
	}: {
		logs: string;
		filteredFormattedLogs: FormattedLogLine[];
		loading: boolean;
		error: string | null;
		showRawLogs: boolean;
		onRefresh: () => void;
		logContainer?: HTMLDivElement | null;
	} = $props();

	function getLevelClass(level: string) {
		switch (level) {
			case 'ERROR':
			case 'FATAL':
				return 'text-red-400 font-bold';
			case 'WARN':
			case 'WARNING':
				return 'text-yellow-400 font-bold';
			case 'DEBUG':
				return 'text-blue-400';
			default:
				return 'text-green-400';
		}
	}
</script>

{#if loading && !logs}
	<div class="space-y-3 rounded-lg bg-gray-950 p-4">
		{#each Array(8) as _}
			<div class="flex gap-3">
				<Skeleton class="h-4 w-20 bg-gray-800" />
				<Skeleton class="h-4 w-12 bg-gray-800" />
				<Skeleton class="h-4 flex-1 bg-gray-800" />
			</div>
		{/each}
	</div>
{:else if error}
	<TabStateMessage title="Failed to load logs" message={error} onRetry={onRefresh} />
{:else if !logs && !loading}
	<div class="py-12 text-center text-gray-500 dark:text-gray-400">
		No relevant logs found in the controller for this resource.
	</div>
{:else}
	<div class="relative overflow-hidden rounded-lg bg-gray-950 shadow-inner">
		{#if showRawLogs}
			<div
				bind:this={logContainer}
				class="scrollbar-thin scrollbar-track-gray-900 scrollbar-thumb-gray-700 max-h-[600px] overflow-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-gray-300"
			>
				<code>{logs}</code>
			</div>
		{:else}
			<div class="h-[600px] w-full">
				{#if filteredFormattedLogs.length === 0}
					<div class="py-8 text-center text-gray-500">No logs match your search.</div>
				{:else}
					<VirtualList
						items={filteredFormattedLogs}
						itemHeight={36}
						buffer={5}
						class="h-full px-4 py-2 font-mono text-xs leading-relaxed text-gray-300"
						bind:scrollContainer={logContainer}
					>
						{#snippet children(line)}
							<div class="flex gap-3 overflow-hidden py-0.5">
								<span class="shrink-0 text-gray-500">[{line.ts}]</span>
								<span class="shrink-0 {getLevelClass(line.level)}">{line.level.padEnd(5)}</span>
								<span class="min-w-0 truncate">{line.msg}</span>
							</div>
						{/snippet}
					</VirtualList>
				{/if}
			</div>
		{/if}
	</div>
{/if}
