<script lang="ts">
	import AdvancedSearch from '$lib/components/search/AdvancedSearch.svelte';
	import FilterBar from '$lib/components/flux/FilterBar.svelte';
	import { SORT_FIELDS, type SortBy } from '$lib/config/sorting';
	import type { FilterState } from '$lib/utils/filtering';
	import { ArrowDown, ArrowUp, ArrowUpDown } from '@lucide/svelte';

	let {
		filters = $bindable(),
		namespaces,
		sortBy,
		sortOrder,
		filteredCount,
		total,
		resourceCount,
		hasActiveFilters,
		onClearFilters,
		onSearch,
		onSort
	}: {
		filters: FilterState;
		namespaces: string[];
		sortBy: SortBy | undefined;
		sortOrder: 'asc' | 'desc';
		filteredCount: number;
		total: number | null;
		resourceCount: number;
		hasActiveFilters: boolean;
		onClearFilters: () => void;
		onSearch: () => void;
		onSort: (field: SortBy) => void;
	} = $props();
</script>

<div class="space-y-4 rounded-lg border border-border bg-card/60 p-4 backdrop-blur-sm">
	<div class="flex flex-col gap-4 lg:flex-row lg:items-center">
		<div class="w-full lg:flex-1">
			<AdvancedSearch
				bind:filters
				placeholder="Search by name, namespace, or use tags like ns:default..."
				onSearch={onSearch}
			/>
		</div>
		<div class="flex items-center gap-1.5">
			<span class="text-xs text-muted-foreground">Sort:</span>
			{#each SORT_FIELDS as opt (opt.key)}
				<button
					type="button"
					class="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors {sortBy === opt.key
						? 'bg-primary text-primary-foreground'
						: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
					aria-pressed={sortBy === opt.key}
					aria-label={`Sort by ${opt.label}: ${sortBy === opt.key ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'not sorted'}`}
					onclick={() => onSort(opt.key)}
				>
					{opt.label}
					{#if sortBy === opt.key}
						{#if sortOrder === 'asc'}
							<ArrowUp size={12} />
						{:else}
							<ArrowDown size={12} />
						{/if}
					{:else}
						<ArrowUpDown size={12} class="opacity-30" />
					{/if}
				</button>
			{/each}
		</div>
		<div class="flex items-center gap-2 text-sm text-muted-foreground">
			<span>
				Showing <strong class="text-foreground">{filteredCount}</strong> of
				<strong class="text-foreground">{total !== null ? total : `${resourceCount}+`}</strong> resources
			</span>
		</div>
	</div>
	<FilterBar bind:filters {namespaces} onClearFilters={onClearFilters} {hasActiveFilters} />
</div>
