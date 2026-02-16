<script lang="ts">
	import { cn } from '$lib/utils';
	import { formatDistanceToNow, formatDuration, intervalToDuration } from 'date-fns';

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

	let {
		timeline = [],
		loading = false,
		onRollback
	}: {
		timeline: ReconciliationEntry[];
		loading?: boolean;
		onRollback?: (historyId: string, revision: string | null) => void;
	} = $props();

	// Filter state
	let filterStatus = $state<'all' | 'success' | 'failure'>('all');
	let expandedEntries = $state<Set<string>>(new Set());

	const filteredTimeline = $derived(
		filterStatus === 'all' ? timeline : timeline.filter((e) => e.status === filterStatus)
	);

	const successCount = $derived(timeline.filter((e) => e.status === 'success').length);
	const failureCount = $derived(timeline.filter((e) => e.status === 'failure').length);

	function toggleExpand(id: string) {
		if (expandedEntries.has(id)) {
			expandedEntries.delete(id);
		} else {
			expandedEntries.add(id);
		}
		expandedEntries = new Set(expandedEntries);
	}

	function getStatusDotClass(status: string) {
		switch (status) {
			case 'success':
				return 'bg-green-500 ring-green-500/30';
			case 'failure':
				return 'bg-red-500 ring-red-500/30';
			default:
				return 'bg-gray-400 ring-gray-400/30';
		}
	}

	function getStatusBadgeClass(status: string) {
		switch (status) {
			case 'success':
				return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
			case 'failure':
				return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
			default:
				return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
		}
	}

	function getTriggerBadgeClass(triggerType: string) {
		switch (triggerType) {
			case 'manual':
				return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
			case 'webhook':
				return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
			case 'rollback':
				return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
			default:
				return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
		}
	}

	function formatDurationMs(ms: number | null): string {
		if (!ms) return 'N/A';
		const duration = intervalToDuration({ start: 0, end: ms });
		return formatDuration(duration, { format: ['minutes', 'seconds'] }) || `${ms}ms`;
	}
</script>

<div class="space-y-4">
	<!-- Filter Tabs -->
	<div class="flex items-center gap-2">
		<button
			type="button"
			class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors {filterStatus === 'all'
				? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
				: 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}"
			onclick={() => (filterStatus = 'all')}
			aria-label="Show all reconciliation events"
		>
			All ({timeline.length})
		</button>
		<button
			type="button"
			class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors {filterStatus === 'success'
				? 'bg-green-600 text-white'
				: 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50'}"
			onclick={() => (filterStatus = 'success')}
			aria-label="Show successful reconciliations"
		>
			Success ({successCount})
		</button>
		<button
			type="button"
			class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors {filterStatus === 'failure'
				? 'bg-red-600 text-white'
				: 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50'}"
			onclick={() => (filterStatus = 'failure')}
			aria-label="Show failed reconciliations"
		>
			Failed ({failureCount})
		</button>
	</div>

	<!-- Loading State -->
	{#if loading}
		<div class="flex justify-center py-12">
			<div
				class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
				aria-label="Loading reconciliation timeline"
			></div>
		</div>
	{:else if filteredTimeline.length === 0}
		<!-- Empty State -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<svg
				class="h-12 w-12 text-gray-300 dark:text-gray-600"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<p class="mt-4 text-sm text-gray-500 dark:text-gray-400">
				{filterStatus === 'all'
					? 'No reconciliation history found for this resource'
					: `No ${filterStatus} reconciliations`}
			</p>
		</div>
	{:else}
		<!-- Timeline -->
		<div class="relative space-y-4">
			{#each filteredTimeline as entry, i (entry.id)}
				<div class="relative flex gap-4">
					<!-- Timeline Line & Dot -->
					<div class="relative flex flex-col items-center">
						<div
							class={cn(
								'h-3 w-3 rounded-full ring-4 ring-white dark:ring-gray-900',
								getStatusDotClass(entry.status)
							)}
							aria-hidden="true"
						></div>
						{#if i < filteredTimeline.length - 1}
							<div class="h-full w-0.5 flex-1 bg-gray-200 dark:bg-gray-700" aria-hidden="true"
							></div>
						{/if}
					</div>

					<!-- Event Card -->
					<div
						class={cn(
							'flex-1 rounded-lg border p-4 transition-all',
							entry.status === 'failure'
								? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10'
								: 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
							'hover:border-primary/30'
						)}
					>
						<div class="flex items-start justify-between gap-4">
							<div class="flex-1">
								<!-- Header -->
								<div class="flex flex-wrap items-center gap-2">
									{#if i === 0}
										<span
											class="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
										>
											CURRENT
										</span>
									{/if}

									<span
										class={cn(
											'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
											getStatusBadgeClass(entry.status)
										)}
									>
										{entry.status.toUpperCase()}
									</span>

									{#if entry.triggerType !== 'automatic'}
										<span
											class={cn(
												'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
												getTriggerBadgeClass(entry.triggerType)
											)}
										>
											{entry.triggerType.toUpperCase()}
										</span>
									{/if}

									{#if entry.revision}
										<span class="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
											{entry.revision.slice(0, 8)}
										</span>
									{/if}

									{#if entry.durationMs}
										<span class="text-xs text-gray-500 dark:text-gray-400">
											{formatDurationMs(entry.durationMs)}
										</span>
									{/if}
								</div>

								<!-- Reason/Message Preview -->
								{#if entry.readyReason || entry.readyMessage}
									<p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
										{#if entry.readyReason}
											<span class="font-medium">{entry.readyReason}:</span>
										{/if}
										{entry.readyMessage?.substring(0, 100)}
										{#if entry.readyMessage && entry.readyMessage.length > 100}
											<button
												onclick={() => toggleExpand(entry.id)}
												class="ml-1 text-primary hover:underline"
												aria-label="Toggle message details"
											>
												{expandedEntries.has(entry.id) ? 'less' : 'more'}
											</button>
										{/if}
									</p>
								{/if}

								<!-- Expanded Details -->
								{#if expandedEntries.has(entry.id)}
									<div class="mt-3 space-y-2 rounded-md bg-gray-50 p-3 dark:bg-gray-900/50">
										{#if entry.readyMessage}
											<div>
												<p class="text-xs font-medium text-gray-500 dark:text-gray-400">
													Message:
												</p>
												<p class="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
													{entry.readyMessage}
												</p>
											</div>
										{/if}
										{#if entry.errorMessage}
											<div>
												<p class="text-xs font-medium text-red-500 dark:text-red-400">Error:</p>
												<p
													class="mt-1 whitespace-pre-wrap text-sm text-red-700 dark:text-red-300"
												>
													{entry.errorMessage}
												</p>
											</div>
										{/if}
									</div>
								{/if}

								<!-- Timestamp -->
								<p class="mt-2 text-xs text-gray-400 dark:text-gray-500">
									{formatDistanceToNow(new Date(entry.reconcileCompletedAt), { addSuffix: true })}
									· {new Date(entry.reconcileCompletedAt).toLocaleString()}
								</p>
							</div>

							<!-- Actions -->
							{#if i > 0 && onRollback && entry.specSnapshot}
								<button
									onclick={() => onRollback(entry.id, entry.revision)}
									class="text-sm font-medium text-primary transition-colors hover:text-primary/70"
									aria-label="Rollback to this revision"
								>
									Rollback
								</button>
							{:else if i === 0}
								<span class="text-xs text-gray-400 dark:text-gray-500">Current</span>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
