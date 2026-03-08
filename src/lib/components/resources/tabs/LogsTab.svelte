<script lang="ts">
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import VirtualList from '$lib/components/ui/VirtualList.svelte';

	interface Props {
		logs: string;
		formattedLogs: Array<{ ts: string; level: string; msg: string; full: string }>;
		loading: boolean;
		error: string | null;
		showRawLogs: boolean;
		onRefresh: () => void;
		onToggleRaw: (value: boolean) => void;
		logContainer: HTMLDivElement | null;
	}

	let {
		logs,
		formattedLogs,
		loading,
		error,
		showRawLogs,
		onRefresh,
		onToggleRaw,
		logContainer = $bindable()
	}: Props = $props();

	let searchQuery = $state('');

	const filteredFormattedLogs = $derived(
		searchQuery
			? formattedLogs.filter(
					(line) =>
						line.msg.toLowerCase().includes(searchQuery.toLowerCase()) ||
						line.level.toLowerCase().includes(searchQuery.toLowerCase())
				)
			: formattedLogs
	);

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

<div
	class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
>
	<div class="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Controller Logs</h3>
		
		<div class="flex flex-1 flex-wrap items-center gap-4 sm:justify-end">
			<div class="relative flex-1 sm:max-w-xs">
				<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
					<svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
					</svg>
				</div>
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search logs..."
					aria-label="Search logs"
					class="block w-full rounded-md border-gray-300 pl-10 text-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
				/>
			</div>

			<div class="flex items-center gap-6">
				<label
					class="flex cursor-pointer items-center gap-2 text-sm text-gray-500 transition-colors select-none hover:text-gray-700 dark:hover:text-gray-300"
				>
					<input
						type="checkbox"
						class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						checked={showRawLogs}
						onchange={(e) => onToggleRaw(e.currentTarget.checked)}
					/>
					Raw JSON
				</label>
				<button
					type="button"
					class="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
					onclick={onRefresh}
					disabled={loading}
					aria-label="Refresh logs"
				>
					<svg
						class="h-4 w-4 {loading ? 'animate-spin' : ''}"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
						/>
					</svg>
					Refresh
				</button>
			</div>
		</div>
	</div>

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
		<div
			class="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/50 dark:bg-red-900/20"
		>
			<svg class="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<h3 class="mt-2 text-sm font-medium text-red-800 dark:text-red-300">Failed to load logs</h3>
			<p class="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
			<div class="mt-4">
				<button
					type="button"
					class="inline-flex items-center gap-1.5 rounded-md bg-red-100 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-100 dark:hover:bg-red-800"
					onclick={onRefresh}
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
					</svg>
					Try Again
				</button>
			</div>
		</div>
	{:else if !logs && !loading}
		<div class="py-12 text-center text-gray-500 dark:text-gray-400">
			No relevant logs found in the controller for this resource.
		</div>
	{:else}
		<div class="relative rounded-lg bg-gray-950 shadow-inner overflow-hidden">
			{#if showRawLogs}
				<div
					bind:this={logContainer}
					class="scrollbar-thin scrollbar-track-gray-900 scrollbar-thumb-gray-700 max-h-[600px] overflow-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-gray-300"
				>
					<code>{logs}</code>
				</div>
			{:else}
				<div bind:this={logContainer} class="h-[600px] w-full">
					{#if filteredFormattedLogs.length === 0}
						<div class="py-8 text-center text-gray-500">No logs match your search.</div>
					{:else}
						<VirtualList items={filteredFormattedLogs} itemHeight={24} buffer={5} class="h-full px-4 py-2 font-mono text-xs leading-relaxed text-gray-300">
							{#snippet children(line)}
								<div class="flex gap-3 py-0.5 whitespace-pre">
									<span class="shrink-0 text-gray-500">[{line.ts}]</span>
									<span class="shrink-0 {getLevelClass(line.level)}">{line.level.padEnd(5)}</span>
									<span class="break-words">{line.msg}</span>
								</div>
							{/snippet}
						</VirtualList>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
