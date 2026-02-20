<script lang="ts">
	import { preferences } from '$lib/stores/preferences.svelte';
	import { formatLastRefresh } from '$lib/utils/polling.svelte';

	interface Props {
		isRefreshing: boolean;
		lastRefreshTime: Date | null;
		onRefresh: () => void;
	}

	let { isRefreshing, lastRefreshTime, onRefresh }: Props = $props();

	const autoRefreshEnabled = $derived(preferences.autoRefresh);
	const refreshInterval = $derived(preferences.refreshInterval);
</script>

<div class="flex flex-wrap items-center gap-3">
	<!-- Manual Refresh Button -->
	<button
		type="button"
		class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-card px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
		onclick={onRefresh}
		disabled={isRefreshing}
		title="Refresh data"
	>
		<svg
			class="h-4 w-4 {isRefreshing ? 'animate-spin' : ''}"
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
		{isRefreshing ? 'Refreshing...' : 'Refresh'}
	</button>

	<!-- Auto-refresh Toggle -->
	<div
		class="flex items-center gap-2 rounded-lg border border-gray-200 bg-card px-3 py-1.5 dark:border-gray-700"
	>
		<button
			type="button"
			class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none {autoRefreshEnabled
				? 'bg-blue-600'
				: 'bg-gray-200'}"
			role="switch"
			aria-checked={autoRefreshEnabled}
			aria-label="Toggle auto-refresh"
			onclick={() => preferences.toggleAutoRefresh()}
		>
			<span
				class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {autoRefreshEnabled
					? 'translate-x-4'
					: 'translate-x-0'}"
			></span>
		</button>
		<span class="text-sm text-gray-600">
			Auto-refresh
			{#if autoRefreshEnabled}
				<span class="text-gray-400">({refreshInterval}s)</span>
			{/if}
		</span>
	</div>

	<!-- Last Refresh Time -->
	{#if lastRefreshTime}
		<span class="text-xs text-gray-400" title={lastRefreshTime.toLocaleString()}>
			Updated {formatLastRefresh(lastRefreshTime)}
		</span>
	{/if}

	<!-- Refreshing Indicator -->
	{#if isRefreshing}
		<div class="flex items-center gap-1 text-xs text-blue-600">
			<span class="relative flex h-2 w-2">
				<span
					class="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"
				></span>
				<span class="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
			</span>
			Syncing...
		</div>
	{/if}
</div>
