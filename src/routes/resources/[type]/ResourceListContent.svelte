<script lang="ts">
	import { FilterX } from '@lucide/svelte';
	import ResourceGrid from '$lib/components/flux/ResourceGrid.svelte';
	import ResourceTable from '$lib/components/flux/ResourceTable.svelte';
	import type { FluxResource } from '$lib/types/flux';

	let {
		resources,
		viewMode,
		showNamespace,
		hasActiveFilters,
		onClearFilters,
		onResourceClick
	}: {
		resources: FluxResource[];
		viewMode: 'table' | 'grid';
		showNamespace: boolean;
		hasActiveFilters: boolean;
		onClearFilters: () => void;
		onResourceClick: (resource: FluxResource) => void;
	} = $props();
</script>

<svelte:boundary>
	{#if resources.length === 0 && hasActiveFilters}
		<div
			class="flex flex-col items-center justify-center rounded-lg border border-border bg-card/60 py-12 text-center"
		>
			<svg
				class="h-12 w-12 text-muted-foreground/30"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
				/>
			</svg>
			<p class="mt-4 text-sm font-medium text-foreground">No resources match your filters</p>
			<p class="mt-1 text-sm text-muted-foreground">
				Try adjusting your search or filter criteria
			</p>
			<button
				type="button"
				class="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
				onclick={onClearFilters}
			>
				<FilterX size={16} />
				Clear Filters
			</button>
		</div>
	{:else if viewMode === 'table'}
		<ResourceTable {resources} {showNamespace} onRowClick={onResourceClick} />
	{:else}
		<ResourceGrid {resources} {showNamespace} onCardClick={onResourceClick} />
	{/if}

	{#snippet failed(error, reset)}
		<div
			class="flex flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 py-12 text-center"
		>
			<svg class="h-10 w-10 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<p class="mt-4 text-sm font-medium text-foreground">Failed to load resources</p>
			<p class="mt-1 text-sm text-muted-foreground">
				{error instanceof Error ? error.message : 'An unexpected error occurred'}
			</p>
			<button
				type="button"
				class="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
				onclick={reset}
			>
				Retry
			</button>
		</div>
	{/snippet}
</svelte:boundary>
