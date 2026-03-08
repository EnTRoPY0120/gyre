<script lang="ts">
	import EventsList from '$lib/components/flux/EventsList.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import type { K8sEvent } from '$lib/types/resource';

	interface Props {
		events: K8sEvent[];
		loading: boolean;
		error: string | null;
		onRefresh: () => void;
	}

	let { events, loading, error, onRefresh }: Props = $props();
</script>

<div
	class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
>
	<div class="mb-4 flex items-center justify-between">
		<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Events</h3>
		<button
			type="button"
			class="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
			onclick={onRefresh}
			disabled={loading}
			aria-label="Refresh events"
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

	{#if loading && events.length === 0}
		<div class="space-y-4">
			{#each Array(3) as _}
				<div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
					<div class="flex items-center gap-2">
						<Skeleton class="h-5 w-20 rounded-full" />
						<Skeleton class="h-5 w-40" />
					</div>
					<Skeleton class="mt-3 h-4 w-full" />
					<Skeleton class="mt-2 h-4 w-3/4" />
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
			<h3 class="mt-2 text-sm font-medium text-red-800 dark:text-red-300">Failed to load events</h3>
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
	{:else}
		<EventsList {events} {loading} {error} />
	{/if}
</div>
