<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/stores';
	import { preferences } from '$lib/stores/preferences';
	import { websocketStore } from '$lib/stores/websocket.svelte';
	import { onMount } from 'svelte';
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

	interface Props {
		data: {
			resourceType: string;
			resourceInfo: {
				displayName: string;
				singularName: string;
				description: string;
			};
			resources: FluxResource[];
			error: string | null;
		};
	}

	let { data }: Props = $props();

	const viewMode = $derived($preferences.viewMode);
	const showNamespace = $derived($preferences.showNamespace);

	// Auto-refresh setup
	const autoRefresh = createAutoRefresh();

	// Real-time updates via SSE
	onMount(() => {
		const unsubscribe = websocketStore.onEvent((event) => {
			// Check if event is relevant to current view
			// Event resourceType is e.g., 'GitRepository'
			// Page resourceType is e.g., 'gitrepositories'
			const eventType = event.resourceType?.toLowerCase();
			const pageType = data.resourceType.toLowerCase();

			// Simple pluralization check or direct match
			if (eventType && (pageType === eventType + 's' || pageType === eventType)) {
				// Invalidate the load function dependency to trigger a background refresh
				invalidate(`flux:${data.resourceType}`);
			}
		});

		return unsubscribe;
	});

	// Initialize filters from URL
	const urlFilters = $derived(searchParamsToFilters($page.url.searchParams));
	let filters = $state<FilterState>({ ...defaultFilterState });

	// Sync filters from URL on mount and URL changes
	$effect(() => {
		filters = { ...urlFilters };
	});

	// Available namespaces for filter dropdown
	const namespaces = $derived(getUniqueNamespaces(data.resources || []));

	// Apply filters to resources
	const filteredResources = $derived(filterResources(data.resources || [], filters));

	// Check if filters are active
	const hasActiveFilters = $derived(checkActiveFilters(filters));

	// Calculate statistics from filtered resources
	const stats = $derived(() => {
		const resources = filteredResources;
		let healthy = 0;
		let progressing = 0;
		let failed = 0;
		let suspended = 0;

		for (const resource of resources) {
			const health = getResourceHealth(
				resource.status?.conditions,
				resource.spec?.suspend as boolean | undefined
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
		goto(`/resources/${data.resourceType}/${namespace}/${name}`);
	}

	function updateFilters(newFilters: FilterState) {
		filters = newFilters;
		// Update URL with new filters
		const params = filtersToSearchParams(newFilters);
		const url = new URL($page.url);
		url.search = params.toString();
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function handleSearch(results: any[]) {
		// handleSearch is now handled by the filteredItems binding,
		// but we still need it for URL sync if we want to keep that
	}

	function handleFilterChange(newFilters: FilterState) {
		updateFilters(newFilters);
	}

	function clearFilters() {
		updateFilters({ ...defaultFilterState });
	}
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col gap-4">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
					{data.resourceInfo.displayName}
				</h1>
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{data.resourceInfo.description}</p>
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
		class="space-y-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
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
			<!-- Results count -->
			<div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
				<span>
					Showing <strong class="text-gray-900 dark:text-gray-100"
						>{filteredResources.length}</strong
					>
					of <strong class="text-gray-900 dark:text-gray-100">{data.resources?.length || 0}</strong> resources
				</span>
			</div>
		</div>
		<!-- Filter Bar -->
		<FilterBar
			{filters}
			{namespaces}
			onFilterChange={handleFilterChange}
			onClearFilters={clearFilters}
			{hasActiveFilters}
		/>
	</div>

	<!-- Error Alert -->
	{#if data.error}
		<div class="rounded-lg border border-red-200 bg-red-50 p-4">
			<div class="flex items-center gap-3">
				<svg class="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<p class="text-sm text-red-700">{data.error}</p>
			</div>
		</div>
	{/if}

	<!-- Statistics Cards -->
	<div class="grid grid-cols-2 gap-4 sm:grid-cols-5">
		<div
			class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
		>
			<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Total</p>
			<p class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{stats().total}</p>
		</div>
		<div
			class="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/30"
		>
			<p class="text-sm font-medium text-green-700 dark:text-green-300">Healthy</p>
			<p class="mt-1 text-2xl font-bold text-green-900 dark:text-green-100">{stats().healthy}</p>
		</div>
		<div
			class="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/30"
		>
			<p class="text-sm font-medium text-blue-700 dark:text-blue-300">Progressing</p>
			<p class="mt-1 text-2xl font-bold text-blue-900 dark:text-blue-100">{stats().progressing}</p>
		</div>
		<div
			class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/30"
		>
			<p class="text-sm font-medium text-red-700 dark:text-red-300">Failed</p>
			<p class="mt-1 text-2xl font-bold text-red-900 dark:text-red-100">{stats().failed}</p>
		</div>
		<div
			class="rounded-lg border border-gray-300 bg-gray-100 p-4 dark:border-gray-600 dark:bg-gray-700"
		>
			<p class="text-sm font-medium text-gray-600 dark:text-gray-300">Suspended</p>
			<p class="mt-1 text-2xl font-bold text-gray-700 dark:text-gray-200">{stats().suspended}</p>
		</div>
	</div>

	<!-- Resource List -->
	{#if filteredResources.length === 0 && hasActiveFilters}
		<div
			class="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white py-12 text-center dark:border-gray-700 dark:bg-gray-800"
		>
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
					d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
				/>
			</svg>
			<p class="mt-4 text-sm font-medium text-gray-900 dark:text-gray-100">
				No resources match your filters
			</p>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
				Try adjusting your search or filter criteria
			</p>
			<button
				type="button"
				class="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
				onclick={clearFilters}
			>
				Clear Filters
			</button>
		</div>
	{:else if viewMode === 'table'}
		<ResourceTable resources={filteredResources} {showNamespace} onRowClick={handleResourceClick} />
	{:else}
		<ResourceGrid resources={filteredResources} {showNamespace} onCardClick={handleResourceClick} />
	{/if}
</div>
