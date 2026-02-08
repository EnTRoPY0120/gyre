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
	import HelmRepositoryDetail from '$lib/components/flux/resources/HelmRepositoryDetail.svelte';
	import HelmChartDetail from '$lib/components/flux/resources/HelmChartDetail.svelte';
	import BucketDetail from '$lib/components/flux/resources/BucketDetail.svelte';
	import OCIRepositoryDetail from '$lib/components/flux/resources/OCIRepositoryDetail.svelte';
	import AlertDetail from '$lib/components/flux/resources/AlertDetail.svelte';
	import ProviderDetail from '$lib/components/flux/resources/ProviderDetail.svelte';
	import ReceiverDetail from '$lib/components/flux/resources/ReceiverDetail.svelte';
	import ImageRepositoryDetail from '$lib/components/flux/resources/ImageRepositoryDetail.svelte';
	import ImagePolicyDetail from '$lib/components/flux/resources/ImagePolicyDetail.svelte';
	import ImageUpdateAutomationDetail from '$lib/components/flux/resources/ImageUpdateAutomationDetail.svelte';
	import InventoryList from '$lib/components/flux/resources/InventoryList.svelte';
	import ResourceDiffViewer from '$lib/components/flux/ResourceDiffViewer.svelte';
	import VersionHistory from '$lib/components/flux/VersionHistory.svelte';
	import CodeViewer from '$lib/components/common/CodeViewer.svelte';
	import DependencyGraph from '$lib/components/graph/DependencyGraph.svelte';
	import { buildResourceGraph } from '$lib/utils/graph';
	import type { FluxResource, K8sCondition } from '$lib/types/flux';
	import { resourceCache } from '$lib/stores/resourceCache.svelte';
	import { sanitizeResource } from '$lib/utils/kubernetes';

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

	interface ResourceDiff {
		kind: string;
		name: string;
		namespace: string;
		desired: string;
		live: string | null;
	}

	interface DiffResponse {
		diffs: ResourceDiff[];
		cached?: boolean;
		timestamp?: number;
		revision?: string;
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

	type TabId = 'overview' | 'graph' | 'spec' | 'status' | 'events' | 'logs' | 'history' | 'diff' | 'yaml';

	let activeTab = $state<TabId>('overview');

	// Events state
	let events = $state<K8sEvent[]>([]);
	let eventsLoading = $state(false);
	let eventsError = $state<string | null>(null);
	let eventsFetched = $state(false);

	// Logs state
	let logs = $state<string>('');
	let logsLoading = $state(false);
	let logsError = $state<string | null>(null);
	let logsFetched = $state(false);
	let showRawLogs = $state(false);
	let logContainer = $state<HTMLDivElement | null>(null);

	// Diff state
	let diffs = $state<ResourceDiff[]>([]);
	let diffsLoading = $state(false);
	let diffsError = $state<string | null>(null);
	let diffsFetched = $state(false);
	let diffsCached = $state(false);
	let diffsTimestamp = $state<number | null>(null);
	let diffsRevision = $state<string | null>(null);

	const formattedLogs = $derived(
		logs
			.split('\n')
			.filter((line) => line.trim())
			.map((line) => {
				try {
					const parsed = JSON.parse(line);
					return {
						ts: parsed.ts ? new Date(parsed.ts).toLocaleTimeString() : '',
						level: (parsed.level || 'info').toUpperCase(),
						msg: parsed.msg || parsed.message || line,
						full: line
					};
				} catch {
					return { ts: '', level: 'INFO', msg: line, full: line };
				}
			})
	);

	function getLevelClass(level: string) {
		switch (level) {
			case 'ERROR':
			case 'FATAL':
				return 'text-red-400 font-bold';
			case 'WARN':
			case 'WARNING':
				return 'text-yellow-400 font-bold';
			case 'DEBUG':
				return 'text-blue-400';
			default:
				return 'text-green-400';
		}
	}

	// Autoscroll to bottom when logs change
	$effect(() => {
		if (logs && logContainer && !showRawLogs) {
			logContainer.scrollTop = logContainer.scrollHeight;
		}
	});

	// History state
	interface ReconciliationEntry {
		id: string;
		revision: string | null;
		status: 'success' | 'failure' | 'unknown';
		readyStatus: string | null;
		readyReason: string | null;
		readyMessage: string | null;
		reconcileCompletedAt: string;
		durationMs: number | null;
		triggerType: 'automatic' | 'manual' | 'webhook' | 'rollback';
		errorMessage: string | null;
		specSnapshot: string | null;
	}

	let timeline = $state<ReconciliationEntry[]>([]);
	let historyLoading = $state(false);
	let historyFetched = $state(false);

	// Detect resource type for specialized views
	const isGitRepository = $derived(data.resourceType === 'gitrepositories');
	const isHelmRelease = $derived(data.resourceType === 'helmreleases');
	const isKustomization = $derived(data.resourceType === 'kustomizations');
	const isHelmRepository = $derived(data.resourceType === 'helmrepositories');
	const isHelmChart = $derived(data.resourceType === 'helmcharts');
	const isBucket = $derived(data.resourceType === 'buckets');
	const isOCIRepository = $derived(data.resourceType === 'ocirepositories');
	const isAlert = $derived(data.resourceType === 'alerts');
	const isProvider = $derived(data.resourceType === 'providers');
	const isReceiver = $derived(data.resourceType === 'receivers');
	const isImageRepository = $derived(data.resourceType === 'imagerepositories');
	const isImagePolicy = $derived(data.resourceType === 'imagepolicies');
	const isImageUpdateAutomation = $derived(data.resourceType === 'imageupdateautomations');
	const hasSpecializedView = $derived(
		isGitRepository || isHelmRelease || isKustomization || isHelmRepository ||
		isHelmChart || isBucket || isOCIRepository || isAlert || isProvider ||
		isReceiver || isImageRepository || isImagePolicy || isImageUpdateAutomation
	);

	// Build graph data for the Graph tab
	const graphData = $derived(buildResourceGraph(resource, data.inventoryResources || []));

	const tabs = $derived.by(() => {
		const base: { id: TabId; label: string }[] = [
			{ id: 'overview', label: 'Overview' },
			{ id: 'graph', label: 'Graph' },
			{ id: 'spec', label: 'Spec' },
			{ id: 'status', label: 'Status' },
			{ id: 'events', label: 'Events' },
			{ id: 'logs', label: 'Logs' },
			{ id: 'history', label: 'History' }
		];

		// Drift detection is only available for Kustomizations
		if (isKustomization) {
			base.push({ id: 'diff', label: 'Drift (Diff)' });
		}

		base.push({ id: 'yaml', label: 'YAML' });
		return base;
	});

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

	// Fetch logs when the Logs tab is selected
	async function fetchLogs() {
		if (logsFetched) return;

		logsLoading = true;
		logsError = null;

		try {
			const response = await fetch(
				`/api/flux/${data.resourceType}/${data.namespace}/${data.name}/logs`
			);

			if (!response.ok) {
				const errData = await response.json();
				throw new Error(errData.message || `Failed to fetch logs: ${response.statusText}`);
			}

			const result = await response.json();
			logs = result.logs || '';
			logsFetched = true;
		} catch (err) {
			logsError = err instanceof Error ? err.message : 'Failed to load logs';
		} finally {
			logsLoading = false;
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
			timeline = result.timeline || [];
			historyFetched = true;
		} catch {
			// Silently ignore errors for now
		} finally {
			historyLoading = false;
		}
	}

	// Fetch diff when the Diff tab is selected
	async function fetchDiff(force = false) {
		if (diffsFetched && !force) return;

		diffsLoading = true;
		diffsError = null;

		try {
			const url = new URL(
				`/api/flux/${data.resourceType}/${data.namespace}/${data.name}/diff`,
				window.location.origin
			);
			if (force) {
				// Add cache-busting parameter to force fresh computation
				url.searchParams.set('force', 'true');
			}

			const response = await fetch(url.toString());

			if (!response.ok) {
				const errData = await response.json();
				throw new Error(errData.message || `Failed to fetch diff: ${response.statusText}`);
			}

			const result: DiffResponse = await response.json();
			diffs = result.diffs || [];
			diffsCached = result.cached || false;
			diffsTimestamp = result.timestamp || null;
			diffsRevision = result.revision || null;
			diffsFetched = true;
		} catch (err) {
			diffsError = err instanceof Error ? err.message : 'Failed to load diff';
		} finally {
			diffsLoading = false;
		}
	}

	async function handleRollback(historyId: string, revision: string | null) {
		const displayRevision = revision ? revision.slice(0, 8) : historyId.slice(0, 8);
		if (!confirm(`Are you sure you want to rollback to ${displayRevision}?`)) return;

		try {
			const response = await fetch(
				`/api/flux/${data.resourceType}/${data.namespace}/${data.name}/rollback`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ historyId, revision })
				}
			);

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Rollback failed');
			}

			alert(`Successfully initiated rollback to ${displayRevision}`);
			historyFetched = false;
			await fetchHistory();
			// Refresh resource data
			await invalidate(`flux:resource:${data.resourceType}:${data.namespace}:${data.name}`);
		} catch (err) {
			alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
		}
	}

	// Format persisted in preferences store now
	// handleExport moved to CodeViewer component

	// Trigger fetch when switching to tabs
	$effect(() => {
		if (activeTab === 'events' && !eventsFetched) {
			fetchEvents();
		}
	});

	$effect(() => {
		if (activeTab === 'logs' && !logsFetched) {
			fetchLogs();
		}
	});

	$effect(() => {
		if (activeTab === 'history' && !historyFetched) {
			fetchHistory();
		}
	});

	$effect(() => {
		if (activeTab === 'diff' && !diffsFetched) {
			fetchDiff();
		}
	});

	// Get conditions safely
	const conditions = $derived<K8sCondition[]>(resource.status?.conditions || []);
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
					conditions={resource.status?.conditions}
					suspended={resource.spec?.suspend as boolean | undefined}
					observedGeneration={resource.status?.observedGeneration}
					generation={resource.metadata?.generation}
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
	<div class="scrollbar-none overflow-x-auto border-b border-gray-200 dark:border-gray-700">
		<nav class="-mb-px flex min-w-max space-x-8">
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
							metadata: { name: string; namespace: string; generation?: number };
							status?: {
								observedGeneration?: number;
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
				{:else if isHelmRepository}
					<HelmRepositoryDetail resource={data.resource} />
				{:else if isHelmChart}
					<HelmChartDetail resource={data.resource} />
				{:else if isBucket}
					<BucketDetail resource={data.resource} />
				{:else if isOCIRepository}
					<OCIRepositoryDetail resource={data.resource} />
				{:else if isAlert}
					<AlertDetail resource={data.resource} />
				{:else if isProvider}
					<ProviderDetail resource={data.resource} />
				{:else if isReceiver}
					<ReceiverDetail resource={data.resource} />
				{:else if isImageRepository}
					<ImageRepositoryDetail resource={data.resource} />
				{:else if isImagePolicy}
					<ImagePolicyDetail resource={data.resource} />
				{:else if isImageUpdateAutomation}
					<ImageUpdateAutomationDetail resource={data.resource} />
				{:else if data.resource.spec}
					<!-- Generic Configuration Card for unknown resource types -->
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
		{:else if activeTab === 'graph'}
			<div
				class="h-[600px] w-full overflow-hidden rounded-xl border border-border bg-card shadow-inner"
			>
				<DependencyGraph nodes={graphData.nodes} edges={graphData.edges} />
			</div>
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
		{:else if activeTab === 'logs'}
			<div
				class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
			>
				<div class="mb-4 flex items-center justify-between">
					<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Controller Logs</h3>
					<div class="flex items-center gap-6">
						<label
							class="flex cursor-pointer items-center gap-2 text-sm text-gray-500 transition-colors select-none hover:text-gray-700 dark:hover:text-gray-300"
						>
							<input
								type="checkbox"
								class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
								bind:checked={showRawLogs}
							/>
							Raw JSON
						</label>
						<button
							type="button"
							class="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
							onclick={() => {
								logsFetched = false;
								fetchLogs();
							}}
							disabled={logsLoading}
						>
							<svg
								class="h-4 w-4 {logsLoading ? 'animate-spin' : ''}"
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
				</div>

				{#if logsLoading}
					<div class="flex h-64 items-center justify-center">
						<div
							class="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"
						></div>
					</div>
				{:else if logsError}
					<div
						class="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400"
					>
						{logsError}
					</div>
				{:else if !logs}
					<div class="py-12 text-center text-gray-500 dark:text-gray-400">
						No relevant logs found in the controller for this resource.
					</div>
				{:else}
					<div class="relative rounded-lg bg-gray-950 shadow-inner">
						<div
							bind:this={logContainer}
							class="scrollbar-thin scrollbar-track-gray-900 scrollbar-thumb-gray-700 max-h-[600px] overflow-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-gray-300"
						>
							{#if showRawLogs}
								<code>{logs}</code>
							{:else}
								{#each formattedLogs as line, i (i)}
									<div class="mb-1 flex gap-3 last:mb-0">
										<span class="shrink-0 text-gray-500">[{line.ts}]</span>
										<span class="shrink-0 {getLevelClass(line.level)}">{line.level}</span>
										<span class="break-words">{line.msg}</span>
									</div>
								{/each}
							{/if}
						</div>
					</div>
				{/if}
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
				<VersionHistory {timeline} loading={historyLoading} onRollback={handleRollback} />
			</div>
		{:else if activeTab === 'diff'}
			<div
				class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
			>
				<div class="mb-4 flex items-center justify-between">
					<div class="flex flex-col gap-1">
						<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Resource Drift</h3>
						{#if diffsTimestamp}
							<div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
								<span>
									Last checked: {new Date(diffsTimestamp).toLocaleTimeString()}
								</span>
								{#if diffsCached}
									<span
										class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
									>
										<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
											/>
										</svg>
										Cached
									</span>
								{/if}
								{#if diffsRevision}
									<span class="font-mono text-[10px]">@ {diffsRevision.slice(0, 8)}</span>
								{/if}
							</div>
						{/if}
					</div>
					<button
						type="button"
						class="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
						onclick={() => {
							diffsFetched = false;
							fetchDiff(true);
						}}
						disabled={diffsLoading}
					>
						<svg
							class="h-4 w-4 {diffsLoading ? 'animate-spin' : ''}"
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
						{diffsLoading ? 'Computing...' : 'Refresh'}
					</button>
				</div>

				{#if diffsLoading}
					<div class="flex h-64 flex-col items-center justify-center gap-4">
						<div
							class="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"
						></div>
						<p class="animate-pulse text-sm text-gray-500">
							Running kustomize build and fetching cluster state...
						</p>
					</div>
				{:else if diffsError}
					<div
						class="rounded-md border {diffsError.includes('only available when')
							? 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20'
							: 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20'} p-6"
					>
						<div
							class="mb-2 flex items-center gap-2 text-base font-semibold {diffsError.includes(
								'only available when'
							)
								? 'text-amber-700 dark:text-amber-400'
								: 'text-red-700 dark:text-red-400'}"
						>
							<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							{diffsError.includes('only available when')
								? 'In-Cluster Deployment Required'
								: 'Failed to Calculate Drift'}
						</div>
						<p
							class="text-sm {diffsError.includes('only available when')
								? 'text-amber-600 dark:text-amber-300'
								: 'text-red-600 dark:text-red-300'}"
						>
							{diffsError}
						</p>
						{#if diffsError.includes('only available when')}
							<div
								class="mt-4 rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-900/10"
							>
								<p class="text-xs font-medium text-amber-900 dark:text-amber-200">
									💡 To use drift detection:
								</p>
								<ol
									class="mt-2 ml-4 list-decimal space-y-1 text-xs text-amber-800 dark:text-amber-300"
								>
									<li>Deploy Gyre to your Kubernetes cluster using the Helm chart</li>
									<li>Ensure Gyre runs in the same cluster as your FluxCD installation</li>
									<li>Access Gyre via the in-cluster service or ingress</li>
								</ol>
							</div>
						{/if}
					</div>
				{:else if diffs.length === 0}
					<div class="py-12 text-center text-gray-500 dark:text-gray-400">
						No resources found in this Kustomization to compare.
					</div>
				{:else}
					<ResourceDiffViewer {diffs} />
				{/if}
			</div>
		{:else if activeTab === 'yaml'}
			<CodeViewer
				data={sanitizeResource(resource) as unknown as Record<string, unknown>}
				title="Full Resource Manifest"
			/>
		{/if}
	</div>
</div>
