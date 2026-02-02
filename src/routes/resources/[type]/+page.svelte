<script lang="ts">
	import { goto } from '$app/navigation';
	import { preferences } from '$lib/stores/preferences';
	import { getResourceHealth } from '$lib/utils/flux';
	import { createAutoRefresh } from '$lib/utils/polling.svelte';
	import ViewToggle from '$lib/components/layout/ViewToggle.svelte';
	import RefreshControl from '$lib/components/layout/RefreshControl.svelte';
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

	// Calculate statistics
	const stats = $derived(() => {
		const resources = data.resources || [];
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
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col gap-4">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold text-gray-900">{data.resourceInfo.displayName}</h1>
				<p class="mt-1 text-sm text-gray-500">{data.resourceInfo.description}</p>
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
		<div class="rounded-lg border border-gray-200 bg-white p-4">
			<p class="text-sm font-medium text-gray-500">Total</p>
			<p class="mt-1 text-2xl font-bold text-gray-900">{stats().total}</p>
		</div>
		<div class="rounded-lg border border-green-200 bg-green-50 p-4">
			<p class="text-sm font-medium text-green-700">Healthy</p>
			<p class="mt-1 text-2xl font-bold text-green-900">{stats().healthy}</p>
		</div>
		<div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
			<p class="text-sm font-medium text-blue-700">Progressing</p>
			<p class="mt-1 text-2xl font-bold text-blue-900">{stats().progressing}</p>
		</div>
		<div class="rounded-lg border border-red-200 bg-red-50 p-4">
			<p class="text-sm font-medium text-red-700">Failed</p>
			<p class="mt-1 text-2xl font-bold text-red-900">{stats().failed}</p>
		</div>
		<div class="rounded-lg border border-gray-300 bg-gray-100 p-4">
			<p class="text-sm font-medium text-gray-600">Suspended</p>
			<p class="mt-1 text-2xl font-bold text-gray-700">{stats().suspended}</p>
		</div>
	</div>

	<!-- Resource List -->
	{#if viewMode === 'table'}
		<ResourceTable
			resources={data.resources}
			{showNamespace}
			onRowClick={handleResourceClick}
		/>
	{:else}
		<ResourceGrid
			resources={data.resources}
			{showNamespace}
			onCardClick={handleResourceClick}
		/>
	{/if}
</div>
