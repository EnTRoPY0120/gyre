<script lang="ts">
	let {
		diffsCount,
		loading,
		timestamp,
		cached,
		revision,
		onExport,
		onRefresh
	}: {
		diffsCount: number;
		loading: boolean;
		timestamp: number | null;
		cached: boolean;
		revision: string | null;
		onExport: () => void;
		onRefresh: () => void;
	} = $props();
</script>

<div class="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
	<div class="flex flex-col gap-1">
		<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Resource Drift</h3>
		{#if timestamp}
			<div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
				<span>Last checked: {new Date(timestamp).toLocaleTimeString()}</span>
				{#if cached}
					<span
						class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
					>
						<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
							/>
						</svg>
						Cached
					</span>
				{/if}
				{#if revision}
					<span class="font-mono text-[10px]">@ {revision.slice(0, 8)}</span>
				{/if}
			</div>
		{/if}
	</div>
	<div class="flex items-center gap-2">
		{#if diffsCount > 0 && !loading}
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
				onclick={onExport}
				aria-label="Export drift report"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
					/>
				</svg>
				Export
			</button>
		{/if}
		<button
			type="button"
			class="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
			onclick={onRefresh}
			disabled={loading}
			aria-label="Refresh drift analysis"
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
			{loading ? 'Computing...' : 'Refresh'}
		</button>
	</div>
</div>
