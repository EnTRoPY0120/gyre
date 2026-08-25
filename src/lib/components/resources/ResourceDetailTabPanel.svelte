<script lang="ts">
	import CodeViewer from '$lib/components/common/CodeViewer.svelte';
	import ErrorDisplay from '$lib/components/ui/ErrorDisplay.svelte';
	import DiffTab, { type DiffError } from '$lib/components/resources/tabs/DiffTab.svelte';
	import EventsTab from '$lib/components/resources/tabs/EventsTab.svelte';
	import HistoryTab from '$lib/components/resources/tabs/HistoryTab.svelte';
	import LogsTab from '$lib/components/resources/tabs/LogsTab.svelte';
	import OverviewTab from '$lib/components/resources/tabs/OverviewTab.svelte';
	import type { TabId } from '$lib/config/tabs';
	import type { FluxResource, K8sCondition } from '$lib/types/flux';
	import type { K8sEvent, ReconciliationEntry, ResourceDiff } from '$lib/types/resource';
	import { sanitizeResource } from '$lib/utils/kubernetes';

	export interface FormattedLog {
		ts: string;
		level: string;
		msg: string;
		full: string;
	}

	let {
		activeTab,
		resource,
		resourceType,
		conditions,
		resourceKey,
		events,
		eventsLoading,
		eventsError,
		logs,
		formattedLogs,
		logsLoading,
		logsError,
		showRawLogs,
		logContainer = $bindable(null),
		timeline,
		historyLoading,
		diffs,
		diffsLoading,
		diffsError,
		diffsTimestamp,
		diffsCached,
		diffsRevision,
		onRefreshEvents,
		onRefreshLogs,
		onToggleRawLogs,
		onRefreshHistory,
		onRollback,
		onRefreshDiff
	}: {
		activeTab: TabId;
		resource: FluxResource;
		resourceType: string;
		conditions: K8sCondition[];
		resourceKey: string;
		events: K8sEvent[];
		eventsLoading: boolean;
		eventsError: string | null;
		logs: string;
		formattedLogs: FormattedLog[];
		logsLoading: boolean;
		logsError: string | null;
		showRawLogs: boolean;
		logContainer: HTMLDivElement | null;
		timeline: ReconciliationEntry[];
		historyLoading: boolean;
		diffs: ResourceDiff[];
		diffsLoading: boolean;
		diffsError: DiffError | null;
		diffsTimestamp: number | null;
		diffsCached: boolean;
		diffsRevision: string | null;
		onRefreshEvents: () => void;
		onRefreshLogs: () => void;
		onToggleRawLogs: (value: boolean) => void;
		onRefreshHistory: () => void;
		onRollback: (historyId: string, revision: string | null) => void;
		onRefreshDiff: () => void;
	} = $props();
</script>

<svelte:boundary>
	<div class="pt-2">
		{#if activeTab === 'overview'}
			<div id="overview-panel" role="tabpanel" aria-labelledby="overview-tab">
				<OverviewTab {resource} {resourceType} {conditions} />
			</div>
		{:else if activeTab === 'spec'}
			<div id="spec-panel" role="tabpanel" aria-labelledby="spec-tab">
				<CodeViewer
					data={sanitizeResource(resource) as unknown as Record<string, unknown>}
					title="Full Resource Manifest"
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
					{events}
					loading={eventsLoading}
					error={eventsError}
					onRefresh={onRefreshEvents}
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
						onRefresh={onRefreshLogs}
						onToggleRaw={onToggleRawLogs}
						bind:logContainer
					/>
				{/key}
			</div>
		{:else if activeTab === 'history'}
			<div id="history-panel" role="tabpanel" aria-labelledby="history-tab">
				<HistoryTab
					{timeline}
					loading={historyLoading}
					onRefresh={onRefreshHistory}
					onRollback={onRollback}
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
					onRefresh={onRefreshDiff}
				/>
			</div>
		{/if}
	</div>

	{#snippet failed(error, reset)}
		<div id="{activeTab}-panel" role="tabpanel" aria-labelledby="{activeTab}-tab">
			<ErrorDisplay
				status={500}
				message={error instanceof Error ? error.message : 'An unexpected error occurred'}
				onRetry={reset}
			/>
		</div>
	{/snippet}
</svelte:boundary>
