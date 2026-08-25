<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { onMount, untrack } from 'svelte';
	import { resolveResourceRouteType } from '$lib/config/resources';
	import { preferences } from '$lib/stores/preferences.svelte';
	import { eventsStore } from '$lib/stores/events.svelte';
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
	import type { FluxResource } from '$lib/types/flux';
	import { SORT_FIELDS, type SortBy } from '$lib/config/sorting';
	import { getResourceStats } from './resource-stats';
	import ResourceListContent from './ResourceListContent.svelte';
	import ResourceListFilters from './ResourceListFilters.svelte';
	import ResourceListHeader from './ResourceListHeader.svelte';
	import ResourceStatsCards from './ResourceStatsCards.svelte';

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

	const autoRefresh = createAutoRefresh({
		invalidate: async () => {
			await Promise.all([invalidate(`flux:${data.resourceType}`), invalidate('gyre:layout')]);
		}
	});

	onMount(() => {
		const unsubscribe = eventsStore.onEvent((event) => {
			const eventRouteType = event.resourceType ? resolveResourceRouteType(event.resourceType) : null;

			if (eventRouteType === data.resourceType) {
				invalidate(`flux:${data.resourceType}`);
			}
		});

		return unsubscribe;
	});

	function parseSortBy(raw: string | null): SortBy | undefined {
		return SORT_FIELDS.some((field) => field.key === raw) ? (raw as SortBy) : undefined;
	}

	let filters = $state<FilterState>(searchParamsToFilters($page.url.searchParams));
	let lastSearchParams = $state($page.url.search.toString());
	let sortBy = $state<SortBy | undefined>(parseSortBy($page.url.searchParams.get('sortBy')));
	let sortOrder = $state<'asc' | 'desc'>(
		$page.url.searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc'
	);

	$effect(() => {
		const currentSync = $page.url.search.toString();
		if (currentSync !== untrack(() => lastSearchParams)) {
			filters = searchParamsToFilters($page.url.searchParams);
			sortBy = parseSortBy($page.url.searchParams.get('sortBy'));
			sortOrder = $page.url.searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc';
			lastSearchParams = currentSync;
		}
	});

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

	const namespaces = $derived(getUniqueNamespaces(data.resources || []));
	const filteredResources = $derived(
		filterResources(data.resources || [], { ...filters, search: debouncedSearch })
	);
	const hasActiveFilters = $derived(checkActiveFilters(filters));
	const stats = $derived(getResourceStats(filteredResources));

	function handleResourceClick(resource: FluxResource) {
		const namespace = resource.metadata.namespace || 'default';
		const name = resource.metadata.name;
		goto(resolve(`/resources/${data.resourceType}/${namespace}/${name}`));
	}

	$effect(() => {
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
		}, 300);

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
		// Search is handled by reactive filtering of filteredResources.
	}

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
	<ResourceListHeader
		displayName={data.resourceInfo.displayName}
		description={data.resourceInfo.description}
		isRefreshing={autoRefresh.isRefreshing}
		lastRefreshTime={autoRefresh.lastRefreshTime}
		onRefresh={autoRefresh.refresh}
	/>

	<ResourceListFilters
		bind:filters
		namespaces={namespaces}
		{sortBy}
		{sortOrder}
		filteredCount={filteredResources.length}
		total={data.total}
		resourceCount={data.resources?.length ?? 0}
		{hasActiveFilters}
		onClearFilters={clearFilters}
		onSearch={handleSearch}
		onSort={applySort}
	/>

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

	<ResourceStatsCards {stats} />
	<ResourceListContent
		resources={filteredResources}
		{viewMode}
		{showNamespace}
		{hasActiveFilters}
		onClearFilters={clearFilters}
		onResourceClick={handleResourceClick}
	/>
</div>
