<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { eventsStore } from '$lib/stores/events.svelte';
	import { createAutoRefresh } from '$lib/utils/polling.svelte';
	import { onMount, untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import StatusBadge from '$lib/components/flux/StatusBadge.svelte';
	import ActionButtons from '$lib/components/flux/ActionButtons.svelte';
	import CodeViewer from '$lib/components/common/CodeViewer.svelte';
	import Breadcrumbs from '$lib/components/common/Breadcrumbs.svelte';
	import OverviewTab from '$lib/components/resources/tabs/OverviewTab.svelte';
	import EventsTab from '$lib/components/resources/tabs/EventsTab.svelte';
	import LogsTab from '$lib/components/resources/tabs/LogsTab.svelte';
	import HistoryTab from '$lib/components/resources/tabs/HistoryTab.svelte';
	import DiffTab from '$lib/components/resources/tabs/DiffTab.svelte';
	import type { FluxResource, K8sCondition } from '$lib/types/flux';
	import type {
		K8sEvent,
		ResourceDiff,
		DiffResponse,
		ReconciliationEntry
	} from '$lib/types/resource';
	import { resourceCache } from '$lib/stores/resourceCache.svelte';
	import { sanitizeResource } from '$lib/utils/kubernetes';
	import { BASE_TABS, YAML_TAB, DIFF_TAB, type TabId } from '$lib/config/tabs';
	import type { DiffError } from '$lib/components/resources/tabs/DiffTab.svelte';
	import ConfirmDialog from '$lib/components/flux/ConfirmDialog.svelte';
	import { getCsrfToken } from '$lib/utils/csrf';

	interface Props {
		data: {
			resourceType: string;
			namespace: string;
			name: string;
			resource: FluxResource;
		};
	}

	let { data }: Props = $props();

	// Make resource reactive via cache store with fallback to initial data
	const resource = $derived(
		resourceCache.getResource(data.resourceType, data.namespace, data.name) || data.resource
	);

	// Auto-refresh setup with targeted invalidation
	createAutoRefresh({
		invalidate: async () => {
			await Promise.all([
				invalidate(`flux:resource:${data.resourceType}:${data.namespace}:${data.name}`),
				invalidate('gyre:layout')
			]);
		}
	});

	// Sync initial data to cache on mount
	onMount(() => {
		resourceCache.setResource(data.resourceType, data.namespace, data.name, data.resource);

		const unsubscribe = eventsStore.onEvent((event) => {
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

	// Tab state with persistence
	const availableTabIds: TabId[] = untrack(() => [
		...BASE_TABS.map((t) => t.id),
		...(data.resourceType === 'kustomizations' ? [DIFF_TAB.id] : []),
		YAML_TAB.id
	]);
	const rawTab = $page.url.searchParams.get('tab') as TabId;
	const initialTab: TabId = availableTabIds.includes(rawTab) ? rawTab : 'overview';
	let activeTab = $state<TabId>(initialTab);

	// Keep activeTab valid on same-component navigation (e.g. switching resource types)
	$effect(() => {
		const currentAvailableTabIds: TabId[] = [
			...BASE_TABS.map((t) => t.id),
			...(data.resourceType === 'kustomizations' ? [DIFF_TAB.id] : []),
			YAML_TAB.id
		];
		const param = $page.url.searchParams.get('tab') as TabId;
		const validTab: TabId = currentAvailableTabIds.includes(param) ? param : 'overview';
		if (activeTab !== validTab) {
			activeTab = validTab;
		}
	});

	function setActiveTab(tab: TabId) {
		activeTab = tab;
		const url = new URL($page.url);
		url.searchParams.set('tab', tab);
		goto(url, { replaceState: true, keepFocus: true, noScroll: true });
	}

	// Fetching states
	let events = $state<K8sEvent[]>([]);
	let eventsLoading = $state(false);
	let eventsError = $state<string | null>(null);
	let eventsFetched = $state(false);

	let logs = $state<string>('');
	let logsLoading = $state(false);
	let logsError = $state<string | null>(null);
	let logsFetched = $state(false);
	let showRawLogs = $state(false);
	let logContainer = $state<HTMLDivElement | null>(null);

	let diffs = $state<ResourceDiff[]>([]);
	let diffsLoading = $state(false);
	let diffsError = $state<DiffError | null>(null);
	let diffsFetched = $state(false);
	let diffsCached = $state(false);
	let diffsTimestamp = $state<number | null>(null);
	let diffsRevision = $state<string | null>(null);

	let timeline = $state<ReconciliationEntry[]>([]);
	let historyLoading = $state(false);
	let historyFetched = $state(false);

	let rollbackConfirmOpen = $state(false);
	let pendingRollback = $state<{ historyId: string; revision: string | null } | null>(null);

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

	// Autoscroll to bottom when logs change
	$effect(() => {
		if (logs && logContainer && !showRawLogs) {
			logContainer.scrollTop = logContainer.scrollHeight;
		}
	});

	const isKustomization = $derived(data.resourceType === 'kustomizations');
	const resourceKey = $derived(JSON.stringify([data.resourceType, data.namespace, data.name]));

	const tabs = $derived.by(() => {
		const base = [...BASE_TABS];
		if (isKustomization) base.push(DIFF_TAB);
		base.push(YAML_TAB);
		return base;
	});

	// Keyboard navigation for tabs
	function handleKeydown(e: KeyboardEvent, index: number) {
		let targetIndex: number | null = null;
		if (e.key === 'ArrowRight') {
			targetIndex = (index + 1) % tabs.length;
		} else if (e.key === 'ArrowLeft') {
			targetIndex = (index - 1 + tabs.length) % tabs.length;
		} else if (e.key === 'Home') {
			targetIndex = 0;
		} else if (e.key === 'End') {
			targetIndex = tabs.length - 1;
		}
		if (targetIndex !== null) {
			e.preventDefault();
			setActiveTab(tabs[targetIndex].id);
			((e.target as HTMLElement).parentElement?.children[targetIndex] as HTMLElement)?.focus();
		}
	}

	let activeAbortController: AbortController | null = null;

	function getNewAbortSignal() {
		if (activeAbortController) {
			activeAbortController.abort();
		}
		activeAbortController = new AbortController();
		return activeAbortController.signal;
	}

	async function fetchEvents() {
		if (eventsFetched) return;
		const signal = getNewAbortSignal();
		eventsLoading = true;
		eventsError = null;
		try {
			const res = await fetch(resolve(`/api/flux/${data.resourceType}/${data.namespace}/${data.name}/events`), { signal });
			if (!res.ok) throw new Error(`Failed to fetch events: ${res.statusText}`);
			const result = await res.json();
			events = result.events || [];
			eventsFetched = true;
		} catch (err) {
			if ((err as Error).name === 'AbortError') return;
			eventsError = err instanceof Error ? err.message : 'Failed to load events';
		} finally {
			eventsLoading = false;
		}
	}

	async function fetchLogs() {
		if (logsFetched) return;
		const signal = getNewAbortSignal();
		logsLoading = true;
		logsError = null;
		try {
			const res = await fetch(resolve(`/api/flux/${data.resourceType}/${data.namespace}/${data.name}/logs`), { signal });
			if (!res.ok) {
				const isJson = res.headers.get('content-type')?.includes('application/json');
				const errMsg = isJson
					? await res.json().then((d: { message?: string }) => d.message).catch(() => null)
					: await res.text().catch(() => null);
				throw new Error(errMsg || `Failed to fetch logs: ${res.statusText}`);
			}
			const result = await res.json();
			logs = result.logs || '';
			logsFetched = true;
		} catch (err) {
			if ((err as Error).name === 'AbortError') return;
			logsError = err instanceof Error ? err.message : 'Failed to load logs';
		} finally {
			logsLoading = false;
		}
	}

	async function fetchHistory() {
		if (historyFetched) return;
		const signal = getNewAbortSignal();
		historyLoading = true;
		try {
			const res = await fetch(resolve(`/api/flux/${data.resourceType}/${data.namespace}/${data.name}/history`), { signal });
			if (!res.ok) throw new Error(`Failed to fetch history: ${res.statusText}`);
			const result = await res.json();
			timeline = result.timeline || [];
			historyFetched = true;
		} catch (err) {
			if ((err as Error).name === 'AbortError') return;
			toast.error('Failed to load history');
		} finally {
			historyLoading = false;
		}
	}

	async function fetchDiff(force = false) {
		if (diffsFetched && !force) return;
		const signal = getNewAbortSignal();
		diffsLoading = true;
		diffsError = null;
		try {
			const url = new URL(resolve(`/api/flux/${data.resourceType}/${data.namespace}/${data.name}/diff`), window.location.origin);
			if (force) url.searchParams.set('force', 'true');
			const res = await fetch(url.toString(), { signal });
			if (!res.ok) {
				const errData = await res.json().catch(() => ({} as { code?: string; message?: string }));
				diffsError = { code: errData.code, message: errData.message || res.statusText };
				return;
			}
			const result: DiffResponse = await res.json();
			diffs = result.diffs || [];
			diffsTimestamp = result.timestamp || null;
			diffsRevision = result.revision || null;
			diffsFetched = true;
		} catch (err) {
			if ((err as Error).name === 'AbortError') return;
			diffsError = {
				code: undefined,
				message: err instanceof Error ? err.message : 'Failed to load diff'
			};
		} finally {
			diffsLoading = false;
		}
	}

	function handleRollback(historyId: string, revision: string | null) {
		pendingRollback = { historyId, revision };
		rollbackConfirmOpen = true;
	}

	async function confirmRollback() {
		if (!pendingRollback) return;
		const myPending = pendingRollback;
		const { historyId, revision } = myPending;
		const displayRevision = revision ? revision.slice(0, 8) : historyId.slice(0, 8);
		try {
			const res = await fetch(resolve(`/api/flux/${data.resourceType}/${data.namespace}/${data.name}/rollback`), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
				body: JSON.stringify({ historyId, revision })
			});
			if (!res.ok) {
				const isJson = res.headers.get('content-type')?.includes('application/json');
				const errMsg = isJson
					? await res.json().then((d: { message?: string }) => d.message).catch(() => null)
					: await res.text().catch(() => null);
				throw new Error(errMsg || 'Rollback failed');
			}
			toast.success(`Successfully initiated rollback to ${displayRevision}`);
			historyFetched = false;
			await fetchHistory();
			await invalidate(`flux:resource:${data.resourceType}:${data.namespace}:${data.name}`);
		} catch (err) {
			toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
		} finally {
			if (pendingRollback === myPending) {
				pendingRollback = null;
			}
		}
	}

	async function viewInKubectl() {
		const kind = resource.kind;
		const command = `kubectl get ${kind.toLowerCase()} ${data.name} -n ${data.namespace}`;
		await copyToClipboard(command);
	}

	async function handleReconcile() {
		try {
			const res = await fetch(resolve(`/api/flux/${data.resourceType}/${data.namespace}/${data.name}/reconcile`), {
				method: 'POST',
				headers: { 'X-CSRF-Token': getCsrfToken() }
			});
			if (!res.ok) throw new Error('Reconciliation failed');
			toast.success('Reconciliation triggered successfully');
			await invalidate(`flux:resource:${data.resourceType}:${data.namespace}:${data.name}`);
		} catch (err) {
			toast.error('Failed to trigger reconciliation');
		}
	}

	async function copyToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			toast.success('Copied to clipboard');
		} catch {
			toast.error('Failed to copy to clipboard');
		}
	}

	// Reset all tab-local state when resource identity changes so stale data doesn't persist
	$effect(() => {
		// Track identity fields to establish reactive dependency
		void data.name;
		void data.namespace;
		void data.resourceType;

		// Abort any in-flight requests from the previous resource
		activeAbortController?.abort();
		activeAbortController = null;

		events = [];
		eventsLoading = false;
		eventsError = null;
		eventsFetched = false;
		logs = '';
		logsLoading = false;
		logsError = null;
		logsFetched = false;
		showRawLogs = false;
		diffs = [];
		diffsLoading = false;
		diffsError = null;
		diffsFetched = false;
		diffsCached = false;
		diffsTimestamp = null;
		diffsRevision = null;
		timeline = [];
		historyLoading = false;
		historyFetched = false;
		rollbackConfirmOpen = false;
		pendingRollback = null;
	});

	// Consolidated effect for tab data fetching
	$effect(() => {
		const tab = activeTab;
		// Also track identity so the effect re-runs when the resource changes
		void data.name;
		void data.namespace;
		void data.resourceType;
		untrack(() => {
			if (tab === 'events' && !eventsFetched) fetchEvents();
			if (tab === 'logs' && !logsFetched) fetchLogs();
			if (tab === 'history' && !historyFetched) fetchHistory();
			if (tab === 'diff' && !diffsFetched) fetchDiff();
		});
	});

	const conditions = $derived<K8sCondition[]>(resource.status?.conditions || []);
</script>

<div class="space-y-6">
	<!-- Breadcrumbs and Header -->
	<div class="space-y-4">
		<Breadcrumbs resourceType={data.resourceType} namespace={data.namespace} name={data.name} />
		
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex-1">
				<div class="flex items-center gap-3">
					<h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">{data.name}</h1>
					<button
						type="button"
						class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
						onclick={async () => await copyToClipboard(data.name)}
						aria-label="Copy resource name"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
						</svg>
					</button>
					<StatusBadge
						conditions={resource.status?.conditions}
						suspended={resource.spec?.suspend as boolean | undefined}
						observedGeneration={resource.status?.observedGeneration}
						generation={resource.metadata?.generation}
					/>
				</div>
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
					{data.resourceType} in <span class="font-medium text-gray-700 dark:text-gray-300">{data.namespace}</span>
				</p>
			</div>
			
			<div class="flex flex-wrap items-center gap-2">
				<button
					type="button"
					class="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
					onclick={viewInKubectl}
					aria-label="View in Kubernetes (copy kubectl command)"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
					</svg>
					Kubectl
				</button>
				<button
					type="button"
					class="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
					onclick={handleReconcile}
					aria-label="Reconcile now"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
					</svg>
					Reconcile Now
				</button>
				<ActionButtons
					resource={resource}
					type={data.resourceType}
					namespace={data.namespace}
					name={data.name}
				/>
			</div>
		</div>
	</div>

	<!-- Tabs -->
	<div class="scrollbar-none overflow-x-auto border-b border-gray-200 dark:border-gray-700">
		<div class="-mb-px flex min-w-max space-x-8" role="tablist" aria-label="Resource Details">
			{#each tabs as tab, i (tab.id)}
				<button
					id="{tab.id}-tab"
					role="tab"
					aria-selected={activeTab === tab.id}
					aria-controls="{tab.id}-panel"
					tabindex={activeTab === tab.id ? 0 : -1}
					type="button"
					class="border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap transition-colors {activeTab ===
					tab.id
						? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
						: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300'}"
					onclick={() => setActiveTab(tab.id)}
					onkeydown={(e) => handleKeydown(e, i)}
				>
					{tab.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Tab Content -->
	<div class="pt-2">
		{#if activeTab === 'overview'}
			<div id="overview-panel" role="tabpanel" aria-labelledby="overview-tab">
				<OverviewTab {resource} resourceType={data.resourceType} {conditions} />
			</div>
		{:else if activeTab === 'spec'}
			<div id="spec-panel" role="tabpanel" aria-labelledby="spec-tab">
				<CodeViewer
					data={resource.spec as Record<string, unknown>}
					title="Resource Spec"
					showDownload={false}
				/>
			</div>
		{:else if activeTab === 'status'}
			<div id="status-panel" role="tabpanel" aria-labelledby="status-tab">
				<CodeViewer
					data={(resource.status as Record<string, unknown>) || {}}
					title="Resource Status"
					showDownload={false}
				/>
			</div>
		{:else if activeTab === 'events'}
			<div id="events-panel" role="tabpanel" aria-labelledby="events-tab">
				<EventsTab
					events={events}
					loading={eventsLoading}
					error={eventsError}
					onRefresh={() => {
						eventsFetched = false;
						fetchEvents();
					}}
				/>
			</div>
		{:else if activeTab === 'logs'}
			<div id="logs-panel" role="tabpanel" aria-labelledby="logs-tab">
				{#key resourceKey}
					<LogsTab
						{logs}
						{formattedLogs}
						loading={logsLoading}
						error={logsError}
						{showRawLogs}
						onRefresh={() => {
							logsFetched = false;
							fetchLogs();
						}}
						onToggleRaw={(v) => (showRawLogs = v)}
						bind:logContainer
					/>
				{/key}
			</div>
		{:else if activeTab === 'history'}
			<div id="history-panel" role="tabpanel" aria-labelledby="history-tab">
				<HistoryTab
					{timeline}
					loading={historyLoading}
					onRefresh={() => {
						historyFetched = false;
						fetchHistory();
					}}
					onRollback={handleRollback}
				/>
			</div>
		{:else if activeTab === 'diff'}
			<div id="diff-panel" role="tabpanel" aria-labelledby="diff-tab">
				<DiffTab
					{diffs}
					loading={diffsLoading}
					error={diffsError}
					timestamp={diffsTimestamp}
					cached={diffsCached}
					revision={diffsRevision}
					onRefresh={() => {
						diffsFetched = false;
						fetchDiff(true);
					}}
				/>
			</div>
		{:else if activeTab === 'yaml'}
			<div id="yaml-panel" role="tabpanel" aria-labelledby="yaml-tab">
				<CodeViewer
					data={sanitizeResource(resource) as unknown as Record<string, unknown>}
					title="Full Resource Manifest"
				/>
			</div>
		{/if}
	</div>
</div>

<ConfirmDialog
	bind:open={rollbackConfirmOpen}
	title="Confirm Rollback"
	description="Are you sure you want to rollback to {pendingRollback?.revision ? pendingRollback.revision.slice(0, 8) : (pendingRollback?.historyId.slice(0, 8) ?? '')}? This will revert the resource to a previous state."
	confirmLabel="Rollback"
	variant="destructive"
	onConfirm={confirmRollback}
/>
