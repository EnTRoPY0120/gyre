<script lang="ts">
	import VirtualList from '$lib/components/ui/VirtualList.svelte';
	import EventCard from './EventCard.svelte';
	import EventsFilterTabs from './EventsFilterTabs.svelte';
	import type { EventFilter, K8sEvent } from './events-list-types';

	interface Props {
		events: K8sEvent[];
		loading?: boolean;
		error?: string | null;
	}

	let { events, loading = false, error = null }: Props = $props();

	let filterType = $state<EventFilter>('all');

	const filteredEvents = $derived(
		filterType === 'all' ? events : events.filter((event) => event.type === filterType)
	);
	const warningCount = $derived(events.filter((event) => event.type === 'Warning').length);
	const normalCount = $derived(events.filter((event) => event.type === 'Normal').length);
</script>

<div class="space-y-4">
	<EventsFilterTabs
		activeFilter={filterType}
		totalCount={events.length}
		{warningCount}
		{normalCount}
		onFilterChange={(filter) => (filterType = filter)}
	/>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<svg class="h-8 w-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
				></circle>
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				></path>
			</svg>
		</div>
	{:else if error}
		<div
			class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/30"
		>
			<div class="flex items-center gap-3">
				<svg class="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<p class="text-sm text-red-700 dark:text-red-400">{error}</p>
			</div>
		</div>
	{:else if filteredEvents.length === 0}
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<svg
				class="h-12 w-12 text-gray-300 dark:text-gray-600"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<p class="mt-4 text-sm text-gray-500 dark:text-gray-400">
				{filterType === 'all' ? 'No events found for this resource' : `No ${filterType.toLowerCase()} events`}
			</p>
		</div>
	{:else}
		<div class="h-[500px] w-full">
			<VirtualList items={filteredEvents} itemHeight={140} buffer={3} class="h-full rounded-xl">
				{#snippet children(event)}
					<EventCard {event} />
				{/snippet}
			</VirtualList>
		</div>
	{/if}
</div>
