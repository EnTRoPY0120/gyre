<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { onMount, untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { eventsStore } from '$lib/stores/events.svelte';
	import { resourceCache } from '$lib/stores/resourceCache.svelte';
	import { createAutoRefresh } from '$lib/utils/polling.svelte';
	import { getCsrfToken } from '$lib/utils/csrf';
	import { BASE_TABS, DIFF_TAB, type TabId } from '$lib/config/tabs';
	import type { FluxResource, K8sCondition } from '$lib/types/flux';
	import type { K8sEvent, ReconciliationEntry, ResourceDiff } from '$lib/types/resource';
	import type { DiffError } from '$lib/components/resources/tabs/DiffTab.svelte';
	import ConfirmDialog from '$lib/components/flux/ConfirmDialog.svelte';
	import { loadResourceDiff, type ResourceDiffLoadResult } from './diff-request';
	import {
		loadResourceEvents,
		loadResourceHistory,
		loadResourceLogs,
		requestResourceRollback
	} from './resource-requests';
	import { matchesResourceEvent } from './resource-event-match';
	import ResourceDetailHeader from '$lib/components/resources/ResourceDetailHeader.svelte';
	import ResourceDetailTabPanel from '$lib/components/resources/ResourceDetailTabPanel.svelte';
	import ResourceDetailTabs from '$lib/components/resources/ResourceDetailTabs.svelte';

	interface Props {
		data: {
			resourceType: string;
			namespace: string;
			name: string;
			resource: FluxResource;
		};
	}

	let { data }: Props = $props();

	const resource = $derived(
		resourceCache.getResource(data.resourceType, data.namespace, data.name) || data.resource
	);

	createAutoRefresh({
		invalidate: async () => {
			await Promise.all([
				invalidate(`flux:resource:${data.resourceType}:${data.namespace}:${data.name}`),
				invalidate('gyre:layout')
			]);
		}
	});

	$effect(() => {
		resourceCache.setResource(data.resourceType, data.namespace, data.name, data.resource);
	});

	onMount(() => {
		const unsubscribe = eventsStore.onEvent((event) => {
			if (matchesResourceEvent(event, data.resourceType, data.namespace, data.name)) {
				invalidate(`flux:resource:${data.resourceType}:${data.namespace}:${data.name}`);
			}
		});
		return unsubscribe;
	});

	function getAvailableTabIds(resourceType = data.resourceType): TabId[] {
		return [
			...BASE_TABS.map((tab) => tab.id),
			...(resourceType === 'kustomizations' ? [DIFF_TAB.id] : [])
		];
	}

	function getValidTab(tab: string | null, resourceType = data.resourceType): TabId {
		const candidate = tab as TabId;
		return getAvailableTabIds(resourceType).includes(candidate) ? candidate : 'overview';
	}

	let activeTab = $state<TabId>(
		untrack(() => getValidTab($page.url.searchParams.get('tab')))
	);

	function setActiveTab(tab: TabId) {
		activeTab = tab;
		const url = new URL($page.url);
		url.searchParams.set('tab', tab);
		goto(url, { replaceState: true, keepFocus: true, noScroll: true });
	}

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

	$effect(() => {
		if (logs && logContainer && !showRawLogs) logContainer.scrollTop = logContainer.scrollHeight;
	});

	const isKustomization = $derived(data.resourceType === 'kustomizations');
	const resourceKey = $derived(JSON.stringify([data.resourceType, data.namespace, data.name]));
	const tabs = $derived.by(() => {
		const base = [...BASE_TABS];
		if (isKustomization) base.push(DIFF_TAB);
		return base;
	});

	$effect(() => {
		const validTab = getValidTab($page.url.searchParams.get('tab'));
		if (activeTab !== validTab) activeTab = validTab;
	});

	function handleKeydown(event: KeyboardEvent, index: number) {
		let targetIndex: number | null = null;
		if (event.key === 'ArrowRight') targetIndex = (index + 1) % tabs.length;
		else if (event.key === 'ArrowLeft') targetIndex = (index - 1 + tabs.length) % tabs.length;
		else if (event.key === 'Home') targetIndex = 0;
		else if (event.key === 'End') targetIndex = tabs.length - 1;
		if (targetIndex !== null) {
			event.preventDefault();
			setActiveTab(tabs[targetIndex].id);
			((event.target as HTMLElement).parentElement?.children[targetIndex] as HTMLElement)?.focus();
		}
	}

	let activeAbortController: AbortController | null = null;
	function getNewAbortSignal() {
		activeAbortController?.abort();
		activeAbortController = new AbortController();
		return activeAbortController.signal;
	}

	async function fetchEvents() {
		if (eventsFetched) return;
		const signal = getNewAbortSignal();
		eventsLoading = true;
		eventsError = null;
		const result = await loadResourceEvents(
			resolve(`/api/v1/flux/${data.resourceType}/${data.namespace}/${data.name}/events`),
			signal
		);
		if ('aborted' in result) {
			eventsLoading = false;
			return;
		}
		if ('error' in result) eventsError = result.error.message;
		else {
			events = result.response.events;
			eventsFetched = true;
		}
		eventsLoading = false;
	}

	async function fetchLogs() {
		if (logsFetched) return;
		const signal = getNewAbortSignal();
		logsLoading = true;
		logsError = null;
		const result = await loadResourceLogs(
			resolve(`/api/v1/flux/${data.resourceType}/${data.namespace}/${data.name}/logs`),
			signal
		);
		if ('aborted' in result) {
			logsLoading = false;
			return;
		}
		if ('error' in result) logsError = result.error.message;
		else {
			logs = result.response.logs;
			logsFetched = true;
		}
		logsLoading = false;
	}

	async function fetchHistory() {
		if (historyFetched) return;
		const signal = getNewAbortSignal();
		historyLoading = true;
		const result = await loadResourceHistory(
			resolve(`/api/v1/flux/${data.resourceType}/${data.namespace}/${data.name}/history`),
			signal
		);
		if ('aborted' in result) {
			historyLoading = false;
			return;
		}
		if ('error' in result) toast.error('Failed to load history');
		else {
			timeline = result.response.timeline;
			historyFetched = true;
		}
		historyLoading = false;
	}

	async function fetchDiff(force = false) {
		if (diffsFetched && !force) return;
		const signal = getNewAbortSignal();
		diffsLoading = true;
		diffsError = null;
		try {
			const url = new URL(
				resolve(`/api/v1/flux/${data.resourceType}/${data.namespace}/${data.name}/diff`),
				window.location.origin
			);
			applyDiffResult(await loadResourceDiff(url.toString(), force, signal));
		} finally {
			diffsLoading = false;
		}
	}

	function applyDiffResult(result: ResourceDiffLoadResult): void {
		if ('aborted' in result) return;
		if ('error' in result) {
			diffsError = result.error;
			return;
		}

		diffs = result.response.diffs || [];
		diffsTimestamp = result.response.timestamp || null;
		diffsRevision = result.response.revision || null;
		diffsFetched = true;
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
			await requestResourceRollback(
				resolve(`/api/v1/flux/${data.resourceType}/${data.namespace}/${data.name}/rollback`),
				{ historyId, revision },
				getCsrfToken()
			);
			toast.success(`Successfully initiated rollback to ${displayRevision}`);
			historyFetched = false;
			await fetchHistory();
			await invalidate(`flux:resource:${data.resourceType}:${data.namespace}:${data.name}`);
		} catch (err) {
			toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
		} finally {
			if (pendingRollback === myPending) pendingRollback = null;
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

	function viewInKubectl() {
		const command = `kubectl get ${resource.kind.toLowerCase()} ${data.name} -n ${data.namespace}`;
		void copyToClipboard(command);
	}

	function refreshEvents() {
		eventsFetched = false;
		void fetchEvents();
	}

	function refreshLogs() {
		logsFetched = false;
		void fetchLogs();
	}

	function refreshHistory() {
		historyFetched = false;
		void fetchHistory();
	}

	function refreshDiff() {
		diffsFetched = false;
		void fetchDiff(true);
	}

	const activeTabLoaders: Partial<Record<TabId, () => void>> = {
		events: () => {
			if (!eventsFetched) void fetchEvents();
		},
		logs: () => {
			if (!logsFetched) void fetchLogs();
		},
		history: () => {
			if (!historyFetched) void fetchHistory();
		},
		diff: () => {
			if (!diffsFetched) void fetchDiff();
		}
	};

	$effect(() => {
		void data.name;
		void data.namespace;
		void data.resourceType;
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

	$effect(() => {
		const tab = activeTab;
		void data.name;
		void data.namespace;
		void data.resourceType;
		untrack(() => {
			activeTabLoaders[tab]?.();
		});
	});

	const conditions = $derived<K8sCondition[]>(resource.status?.conditions || []);
</script>

<div class="space-y-6">
	<ResourceDetailHeader
		{resource}
		resourceType={data.resourceType}
		namespace={data.namespace}
		name={data.name}
		onCopyName={() => void copyToClipboard(data.name)}
		onViewInKubectl={viewInKubectl}
	/>

	<ResourceDetailTabs
		{tabs}
		{activeTab}
		onSelectTab={setActiveTab}
		onKeydown={handleKeydown}
	/>

	{#key activeTab}
		<ResourceDetailTabPanel
			{activeTab}
			{resource}
			resourceType={data.resourceType}
			{conditions}
			{resourceKey}
			{events}
			{eventsLoading}
			eventsError={eventsError}
			{logs}
			{formattedLogs}
			{logsLoading}
			logsError={logsError}
			{showRawLogs}
			bind:logContainer
			{timeline}
			historyLoading={historyLoading}
			{diffs}
			diffsLoading={diffsLoading}
			diffsError={diffsError}
			diffsTimestamp={diffsTimestamp}
			diffsCached={diffsCached}
			diffsRevision={diffsRevision}
			onRefreshEvents={refreshEvents}
			onRefreshLogs={refreshLogs}
			onToggleRawLogs={(value) => (showRawLogs = value)}
			onRefreshHistory={refreshHistory}
			onRollback={handleRollback}
			onRefreshDiff={refreshDiff}
		/>
	{/key}
</div>

<ConfirmDialog
	bind:open={rollbackConfirmOpen}
	title="Confirm Rollback"
	description="Are you sure you want to rollback to {pendingRollback?.revision ? pendingRollback.revision.slice(0, 8) : (pendingRollback?.historyId.slice(0, 8) ?? '')}? This will revert the resource to a previous state."
	confirmLabel="Rollback"
	variant="destructive"
	onConfirm={confirmRollback}
/>
