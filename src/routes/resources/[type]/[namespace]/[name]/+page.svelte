<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { websocketStore } from '$lib/stores/websocket.svelte';
	import { onMount } from 'svelte';
	import StatusBadge from '$lib/components/flux/StatusBadge.svelte';
	import ActionButtons from '$lib/components/flux/ActionButtons.svelte';
	import ResourceMetadata from '$lib/components/flux/ResourceMetadata.svelte';
	import ConditionList from '$lib/components/flux/ConditionList.svelte';
	import EventsList from '$lib/components/flux/EventsList.svelte';
	import GitRepositoryDetail from '$lib/components/flux/resources/GitRepositoryDetail.svelte';
	import HelmReleaseDetail from '$lib/components/flux/resources/HelmReleaseDetail.svelte';
	import KustomizationDetail from '$lib/components/flux/resources/KustomizationDetail.svelte';
	import InventoryList from '$lib/components/flux/resources/InventoryList.svelte';
	import VersionHistory from '$lib/components/flux/VersionHistory.svelte';
	import CodeViewer from '$lib/components/common/CodeViewer.svelte';
	import type { FluxResource, K8sCondition } from '$lib/types/flux';
	import { resourceCache } from '$lib/stores/resourceCache.svelte';

	interface K8sEvent {
		type: 'Normal' | 'Warning';
		reason: string;
		message: string;
		count: number;
		firstTimestamp: string | null;
		lastTimestamp: string | null;
		source: {
			component: string;
		};
	}

	interface Props {
		data: {
			resourceType: string;
			namespace: string;
			name: string;
			resource: FluxResource;
			inventoryResources?: FluxResource[];
		};
	}

	let { data }: Props = $props();

	// Make resource reactive via cache store with fallback to initial data
	const resource = $derived(
		resourceCache.getResource(data.resourceType, data.namespace, data.name) || data.resource
	);

	// Sync initial data to cache on mount
	onMount(() => {
		resourceCache.setResource(data.resourceType, data.namespace, data.name, data.resource);

		const unsubscribe = websocketStore.onEvent((event) => {
			if (
				event.resource &&
				event.resource.metadata.name === data.name &&
				event.resource.metadata.namespace === data.namespace &&
				event.resourceType === data.resource.kind
			) {
				invalidate(`flux:resource:${data.resourceType}:${data.namespace}:${data.name}`);
			}
		});
		return unsubscribe;
	});

	type TabId = 'overview' | 'spec' | 'status' | 'events' | 'history' | 'yaml';

	let activeTab = $state<TabId>('overview');

	// Events state
	let events = $state<K8sEvent[]>([]);
	let eventsLoading = $state(false);
	let eventsError = $state<string | null>(null);
	let eventsFetched = $state(false);

	// History state
	let history = $state<
		Array<{ revision: string; timestamp: string; status: string; message?: string }>
	>([]);
	let historyLoading = $state(false);
	let historyFetched = $state(false);

	const tabs: { id: TabId; label: string }[] = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'spec', label: 'Spec' },
		{ id: 'status', label: 'Status' },
		{ id: 'events', label: 'Events' },
		{ id: 'history', label: 'History' },
		{ id: 'yaml', label: 'YAML' }
	];

	function goBack() {
		goto(resolve(`/resources/${data.resourceType}`));
	}

	// Fetch events when the Events tab is selected
	async function fetchEvents() {
		if (eventsFetched) return;

		eventsLoading = true;
		eventsError = null;

		try {
			const response = await fetch(
				`/api/flux/${data.resourceType}/${data.namespace}/${data.name}/events`
			);

			if (!response.ok) {
				throw new Error(`Failed to fetch events: ${response.statusText}`);
			}

			const result = await response.json();
			events = result.events || [];
			eventsFetched = true;
		} catch (err) {
			eventsError = err instanceof Error ? err.message : 'Failed to load events';
		} finally {
			eventsLoading = false;
		}
	}

	// Fetch history when the History tab is selected
	async function fetchHistory() {
		if (historyFetched) return;

		historyLoading = true;

		try {
			const response = await fetch(
				`/api/flux/${data.resourceType}/${data.namespace}/${data.name}/history`
			);

			if (!response.ok) {
				throw new Error(`Failed to fetch history: ${response.statusText}`);
			}

			const result = await response.json();
			history = result.history || [];
			historyFetched = true;
		} catch {
			// Silently ignore errors for now
		} finally {
			historyLoading = false;
		}
	}

	async function handleRollback(revision: string) {
		if (!confirm(`Are you sure you want to rollback to version v${revision}?`)) return;

		try {
			const response = await fetch(
				`/api/flux/${data.resourceType}/${data.namespace}/${data.name}/rollback`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ revision })
				}
			);

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Rollback failed');
			}

			alert(`Successfully requested rollback to v${revision}`);
			historyFetched = false;
			await fetchHistory();
		} catch (err) {
			alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
		}
	}

	// Format persisted in preferences store now
	// handleExport moved to CodeViewer component

	// Trigger fetch when switching to events tab
	$effect(() => {
		if (activeTab === 'events' && !eventsFetched) {
			fetchEvents();
		}
	});

	$effect(() => {
		if (activeTab === 'history' && !historyFetched) {
			fetchHistory();
		}
	});

	// Get conditions safely
	const conditions = $derived<K8sCondition[]>(resource.status?.conditions || []);

	// Detect resource type for specialized views
	const isGitRepository = $derived(data.resourceType === 'gitrepositories');
	const isHelmRelease = $derived(data.resourceType === 'helmreleases');
	const isKustomization = $derived(data.resourceType === 'kustomizations');
</script>

<div class="space-y-6">
	<!-- Header with Back Button -->
	<div class="flex items-start gap-4">
		<button
			type="button"
			class="mt-1 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
			onclick={goBack}
			aria-label="Go back"
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
		</button>
		<div class="flex-1">
			<div class="flex items-center gap-3">
				<h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">{data.name}</h1>
				<StatusBadge
					conditions={data.resource.status?.conditions}
					suspended={data.resource.spec?.suspend as boolean | undefined}
				/>
			</div>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
				{data.resourceType} in {data.namespace}
			</p>
		</div>
		<ActionButtons
			resource={data.resource}
			type={data.resourceType}
			namespace={data.namespace}
			name={data.name}
		/>
	</div>

	<!-- Tabs -->
	<div class="border-b border-gray-200 dark:border-gray-700">
		<nav class="-mb-px flex space-x-8">
			{#each tabs as tab (tab.id)}
				<button
					type="button"
					class="border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap transition-colors {activeTab ===
					tab.id
						? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
						: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300'}"
					onclick={() => (activeTab = tab.id)}
				>
					{tab.label}
				</button>
			{/each}
		</nav>
	</div>

	<!-- Tab Content -->
	<div class="pt-2">
		{#if activeTab === 'overview'}
			<!-- Metadata and Conditions (always shown) -->
			<div class="grid gap-6 lg:grid-cols-2">
				<!-- Metadata Card -->
				<div
					class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
				>
					<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Metadata</h3>
					<ResourceMetadata metadata={data.resource.metadata} />
				</div>

				<!-- Conditions Card -->
				<div
					class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
				>
					<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Conditions</h3>
					<ConditionList {conditions} />
				</div>
			</div>

			<!-- Resource-Specific Details -->
			<div class="mt-6 space-y-6">
				{#if data.inventoryResources && data.inventoryResources.length > 0}
					<InventoryList
						resources={data.inventoryResources as unknown as Array<{
							kind: string;
							metadata: { name: string; namespace: string };
							status?: {
								conditions?: Array<{ type: string; status: 'True' | 'False' | 'Unknown' }>;
							};
							error?: string;
						}>}
					/>
				{/if}

				{#if isGitRepository}
					<GitRepositoryDetail resource={data.resource} />
				{:else if isHelmRelease}
					<HelmReleaseDetail resource={data.resource} />
				{:else if isKustomization}
					<KustomizationDetail resource={data.resource} />
				{:else if data.resource.spec}
					<!-- Generic Configuration Card for other resource types -->
					<div
						class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
					>
						<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
							Configuration
						</h3>
						<dl class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
							{#each Object.entries(data.resource.spec).slice(0, 9) as [key, value], index (index)}
								<div>
									<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">{key}</dt>
									<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
										{#if typeof value === 'object'}
											<code class="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-700"
												>{JSON.stringify(value)}</code
											>
										{:else if typeof value === 'boolean'}
											<span
												class="inline-flex rounded-md px-2 py-0.5 text-xs font-medium {value
													? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
													: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}"
											>
												{value ? 'Yes' : 'No'}
											</span>
										{:else}
											{value}
										{/if}
									</dd>
								</div>
							{/each}
						</dl>
					</div>
				{/if}
			</div>
		{:else if activeTab === 'spec'}
			<CodeViewer
				data={data.resource.spec as Record<string, unknown>}
				title="Resource Spec"
				showDownload={false}
			/>
		{:else if activeTab === 'status'}
			<CodeViewer
				data={(data.resource.status as Record<string, unknown>) || {}}
				title="Resource Status"
				showDownload={false}
			/>
		{:else if activeTab === 'events'}
			<div
				class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
			>
				<div class="mb-4 flex items-center justify-between">
					<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Events</h3>
					<button
						type="button"
						class="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
						onclick={() => {
							eventsFetched = false;
							fetchEvents();
						}}
						disabled={eventsLoading}
					>
						<svg
							class="h-4 w-4 {eventsLoading ? 'animate-spin' : ''}"
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
				<EventsList {events} loading={eventsLoading} error={eventsError} />
			</div>
		{:else if activeTab === 'history'}
			<div
				class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
			>
				<div class="mb-4 flex items-center justify-between">
					<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Version History</h3>
					<button
						type="button"
						class="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
						onclick={() => {
							historyFetched = false;
							fetchHistory();
						}}
						disabled={historyLoading}
					>
						<svg
							class="h-4 w-4 {historyLoading ? 'animate-spin' : ''}"
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
				<VersionHistory {history} loading={historyLoading} onRollback={handleRollback} />
			</div>
		{:else if activeTab === 'yaml'}
			<CodeViewer
				data={data.resource as unknown as Record<string, unknown>}
				title="Full Resource Manifest"
			/>
		{/if}
	</div>
</div>
