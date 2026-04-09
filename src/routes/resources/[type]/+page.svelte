<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { resolveResourceRouteType } from '$lib/config/resources';
	import { preferences } from '$lib/stores/preferences.svelte';
	import { eventsStore } from '$lib/stores/events.svelte';
	import { onMount, untrack } from 'svelte';
	import { getResourceHealth } from '$lib/utils/flux';
	import { createAutoRefresh } from '$lib/utils/polling.svelte';
	import {
		filterResources,
		getUniqueNamespaces,
		hasActiveFilters as checkActiveFilters,
		searchParamsToFilters,
		filtersToSearchParams,
		defaultFilterState,
		type FilterState
	} from '$lib/utils/filtering';
	import ViewToggle from '$lib/components/layout/ViewToggle.svelte';
	import RefreshControl from '$lib/components/layout/RefreshControl.svelte';
	import AdvancedSearch from '$lib/components/search/AdvancedSearch.svelte';
	import FilterBar from '$lib/components/flux/FilterBar.svelte';
	import ResourceTable from '$lib/components/flux/ResourceTable.svelte';
	import ResourceGrid from '$lib/components/flux/ResourceGrid.svelte';
	import type { FluxResource } from '$lib/types/flux';
	import { SORT_FIELDS, type SortBy } from '$lib/config/sorting';
	import { FilterX, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-svelte';

	interface Props {
		data: {
			resourceType: string;
			resourceInfo: {
				displayName: string;
				description: string;
			};
			resources: FluxResource[];
			total: number | null;
			sortBy: 'name' | 'age' | 'status' | undefined;
			sortOrder: 'asc' | 'desc';
			error: string | null;
		};
	}

	let { data }: Props = $props();

	const viewMode = $derived(preferences.viewMode);
	const showNamespace = $derived(preferences.showNamespace);

	// Auto-refresh setup
	const autoRefresh = createAutoRefresh({
		invalidate: async () => {
			await Promise.all([invalidate(`flux:${data.resourceType}`), invalidate('gyre:layout')]);
		}
	});

	// Real-time updates via SSE
	onMount(() => {
		const unsubscribe = eventsStore.onEvent((event) => {
			const eventRouteType = event.resourceType ? resolveResourceRouteType(event.resourceType) : null;

			if (eventRouteType === data.resourceType) {
				// Invalidate the load function dependency to trigger a background refresh
				invalidate(`flux:${data.resourceType}`);
			}
		});

		return unsubscribe;
	});

	// ─── URL-derived state ───────────────────────────────────────────────────────

	function parseSortBy(raw: string | null): SortBy | undefined {
		return SORT_FIELDS.some((f) => f.key === raw) ? (raw as SortBy) : undefined;
	}

	// Initialize filters from URL - using $state for two-way binding with AdvancedSearch
	let filters = $state<FilterState>(searchParamsToFilters($page.url.searchParams));

	// Track the last synced URL search params to avoid overwriting local state
	let lastSearchParams = $state($page.url.search.toString());

	// Sort state — declared alongside other URL-derived state so effects below see them
	let sortBy = $state<SortBy | undefined>(
		parseSortBy($page.url.searchParams.get('sortBy'))
	);
	let sortOrder = $state<'asc' | 'desc'>(
		$page.url.searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc'
	);

	// Sync filters and sort from URL when URL changes (e.g. back button, or other navigation).
	// lastSearchParams is read with untrack so that our own writes to it (from the debounced
	// effect below) do not re-trigger this effect and spuriously reset state before $page.url
	// has reflected the new URL.
	$effect(() => {
		const currentSync = $page.url.search.toString();
		if (currentSync !== untrack(() => lastSearchParams)) {
			filters = searchParamsToFilters($page.url.searchParams);
			sortBy = parseSortBy($page.url.searchParams.get('sortBy'));
			sortOrder = $page.url.searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc';
			lastSearchParams = currentSync;
		}
	});

	// Debounced search term to avoid rebuilding Fuse.js index on every keystroke
	let debouncedSearch = $state($page.url.searchParams.get('q') ?? '');

	$effect(() => {
		const search = filters.search;
		if (search === '') {
			debouncedSearch = '';
			return;
		}
		const timeoutId = setTimeout(() => {
			debouncedSearch = search;
		}, 200);
		return () => clearTimeout(timeoutId);
	});

	// Available namespaces for filter dropdown
	const namespaces = $derived(getUniqueNamespaces(data.resources || []));

	// Apply filters to resources — use debouncedSearch for the expensive fuzzy/Fuse.js path
	const filteredResources = $derived(
		filterResources(data.resources || [], { ...filters, search: debouncedSearch })
	);

	// Check if filters are active
	const hasActiveFilters = $derived(checkActiveFilters(filters));

	// Calculate statistics from filtered resources
	const stats = $derived.by(() => {
		const resources = filteredResources;
		let healthy = 0;
		let progressing = 0;
		let failed = 0;
		let suspended = 0;

		for (const resource of resources) {
			const health = getResourceHealth(
				resource.status?.conditions,
				resource.spec?.suspend as boolean | undefined,
				resource.status?.observedGeneration,
				resource.metadata?.generation
			);

			switch (health) {
				case 'healthy':
					healthy++;
					break;
				case 'progressing':
					progressing++;
					break;
				case 'failed':
					failed++;
					break;
				case 'suspended':
					suspended++;
					break;
			}
		}

		return {
			total: resources.length,
			healthy,
			progressing,
			failed,
			suspended
		};
	});

	function handleResourceClick(resource: FluxResource) {
		const namespace = resource.metadata.namespace || 'default';
		const name = resource.metadata.name;
		goto(resolve(`/resources/${data.resourceType}/${namespace}/${name}`));
	}

	// Sync filters to URL with debounce to avoid focus loss during typing
	$effect(() => {
		// Capture all reactive dependencies we want to track
		const currentFilters = {
			search: filters.search,
			namespace: filters.namespace,
			status: filters.status,
			labels: filters.labels,
			useRegex: filters.useRegex
		};
		const currentSortBy = sortBy;
		const currentSortOrder = sortOrder;

		const timeoutId = setTimeout(() => {
			const params = filtersToSearchParams(currentFilters);
			// When filters are active, we don't preserve pagination (limit/offset)
			// to ensure we're filtering against a complete result set from the server.
			// Sort state is still preserved.
			if (currentSortBy) {
				params.set('sortBy', currentSortBy);
				params.set('sortOrder', currentSortOrder);
			}
			const newSearch = params.toString();

			if (newSearch !== $page.url.search.toString().replace(/^\?/, '')) {
				void goto(`?${newSearch}`, {
					replaceState: true,
					noScroll: true,
					keepFocus: true
				});
				lastSearchParams = `?${newSearch}`;
			}
		}, 300); // 300ms debounce

		return () => clearTimeout(timeoutId);
	});

	function clearFilters() {
		filters.search = defaultFilterState.search;
		filters.namespace = defaultFilterState.namespace;
		filters.status = defaultFilterState.status;
		filters.labels = defaultFilterState.labels;
		filters.useRegex = defaultFilterState.useRegex;
	}

	function handleSearch() {
		// Search is handled by reactive filtering of filteredResources
	}

	// applySort updates state only; URL sync is handled by the debounced effect above.
	function applySort(field: SortBy) {
		if (sortBy === field) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			sortBy = field;
			sortOrder = 'asc';
		}
	}
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col gap-4">
		<div class="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="font-display text-2xl font-bold text-foreground">
					{data.resourceInfo.displayName}
				</h1>
				<p class="mt-1 text-sm text-muted-foreground">{data.resourceInfo.description}</p>
			</div>
			<ViewToggle />
		</div>
		<!-- Refresh Controls -->
		<RefreshControl
			isRefreshing={autoRefresh.isRefreshing}
			lastRefreshTime={autoRefresh.lastRefreshTime}
			onRefresh={autoRefresh.refresh}
		/>
	</div>

	<!-- Search and Filters -->
	<div
		class="space-y-4 rounded-lg border border-border bg-card/60 p-4 backdrop-blur-sm"
	>
		<div class="flex flex-col gap-4 lg:flex-row lg:items-center">
			<!-- Search -->
			<div class="w-full lg:flex-1">
				<AdvancedSearch
					bind:filters
					placeholder="Search by name, namespace, or use tags like ns:default..."
					onSearch={handleSearch}
				/>
			</div>
			<!-- Sort controls -->
			<div class="flex items-center gap-1.5">
				<span class="text-xs text-muted-foreground">Sort:</span>
				{#each SORT_FIELDS as opt (opt.key)}
					<button
						type="button"
						class="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors {sortBy === opt.key
							? 'bg-primary text-primary-foreground'
							: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
						aria-pressed={sortBy === opt.key}
						aria-label={`Sort by ${opt.label}: ${
							sortBy === opt.key
								? sortOrder === 'asc'
									? 'ascending'
									: 'descending'
								: 'not sorted'
						}`}
						onclick={() => applySort(opt.key)}
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
			<!-- Results count -->
			<div class="flex items-center gap-2 text-sm text-muted-foreground">
				<span>
					Showing <strong class="text-foreground"
						>{filteredResources.length}</strong
					>
					of <strong class="text-foreground"
						>{data.total !== null ? data.total : `${data.resources?.length ?? 0}+`}</strong
					> resources
				</span>
			</div>
		</div>
		<!-- Filter Bar -->
		<FilterBar bind:filters {namespaces} onClearFilters={clearFilters} {hasActiveFilters} />
	</div>

	<!-- Error Alert -->
	{#if data.error}
		<div class="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
			<div class="flex items-center gap-3">
				<svg class="h-5 w-5 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<p class="text-sm text-destructive">{data.error}</p>
			</div>
		</div>
	{/if}

	<!-- Statistics Cards -->
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-5">
		<div
			class="rounded-xl border border-border bg-card p-4 transition-colors"
		>
			<p class="text-sm font-medium text-muted-foreground">Total</p>
			<p class="mt-1 text-2xl font-bold text-foreground">{stats.total}</p>
		</div>
		<div
			class="rounded-xl border border-green-500/20 bg-card p-4 transition-colors hover:bg-green-500/[0.02]"
		>
			<p class="text-sm font-medium text-green-600 dark:text-green-500">Healthy</p>
			<p class="mt-1 text-2xl font-bold text-green-600 dark:text-green-500">{stats.healthy}</p>
		</div>
		<div
			class="rounded-xl border border-primary/20 bg-card p-4 transition-colors hover:bg-primary/[0.02]"
		>
			<p class="text-sm font-medium text-primary">Progressing</p>
			<p class="mt-1 text-2xl font-bold text-primary">{stats.progressing}</p>
		</div>
		<div
			class="rounded-xl border border-destructive/20 bg-card p-4 transition-colors hover:bg-destructive/[0.02]"
		>
			<p class="text-sm font-medium text-destructive">Failed</p>
			<p class="mt-1 text-2xl font-bold text-destructive">{stats.failed}</p>
		</div>
		<div
			class="rounded-xl border border-amber-500/20 bg-card p-4 transition-colors hover:bg-amber-500/[0.02]"
		>
			<p class="text-sm font-medium text-amber-500">Suspended</p>
			<p class="mt-1 text-2xl font-bold text-amber-500">{stats.suspended}</p>
		</div>
	</div>

	<!-- Resource List -->
	<svelte:boundary>
		{#if filteredResources.length === 0 && hasActiveFilters}
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
				<p class="mt-4 text-sm font-medium text-foreground">
					No resources match your filters
				</p>
				<p class="mt-1 text-sm text-muted-foreground">
					Try adjusting your search or filter criteria
				</p>
				<button
					type="button"
					class="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
					onclick={clearFilters}
				>
					<FilterX size={16} />
					Clear Filters
				</button>
			</div>
		{:else if viewMode === 'table'}
			<ResourceTable resources={filteredResources} {showNamespace} onRowClick={handleResourceClick} />
		{:else}
			<ResourceGrid resources={filteredResources} {showNamespace} onCardClick={handleResourceClick} />
		{/if}

		{#snippet failed(error, reset)}
			<div class="flex flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 py-12 text-center">
				<svg class="h-10 w-10 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
</div>
