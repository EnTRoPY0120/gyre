<script lang="ts">
	import { cn } from '$lib/utils';
	import { formatDistanceToNow } from 'date-fns';
	import type { ReconciliationEntry } from '$lib/types/reconciliation';
	import {
		formatDurationMs,
		getStatusBadgeClass,
		getStatusDotClass,
		getTriggerBadgeClass
	} from './version-history-utils';

	let {
		entry,
		index,
		total,
		expanded = false,
		onToggle,
		onRollback
	}: {
		entry: ReconciliationEntry;
		index: number;
		total: number;
		expanded?: boolean;
		onToggle: () => void;
		onRollback?: (historyId: string, revision: string | null) => void;
	} = $props();
</script>

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
		{#if index < total - 1}
			<div class="h-full w-0.5 flex-1 bg-gray-200 dark:bg-gray-700" aria-hidden="true"></div>
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
					{#if index === 0}
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

					{#if entry.durationMs !== undefined && entry.durationMs !== null}
						<span class="text-xs text-gray-500 dark:text-gray-400">
							{formatDurationMs(entry.durationMs)}
						</span>
					{/if}
				</div>

				<!-- Reason/Message Preview -->
				{#if entry.readyReason || entry.readyMessage || entry.errorMessage}
					<p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
						{#if entry.readyReason}
							<span class="font-medium">{entry.readyReason}:</span>
						{/if}
						{#if entry.readyMessage}
							{entry.readyMessage?.substring(0, 100)}
						{/if}
						{#if entry.errorMessage && !entry.readyMessage}
							<span class="text-red-600 dark:text-red-400">{entry.errorMessage.substring(0, 100)}</span>
						{/if}
						{#if (entry.readyMessage && entry.readyMessage.length > 100) || entry.errorMessage}
							<button
								onclick={onToggle}
								class="ml-1 text-primary hover:underline"
								aria-label="Toggle message details"
							>
								{expanded ? 'less' : 'more'}
							</button>
						{/if}
					</p>
				{/if}

				<!-- Expanded Details -->
				{#if expanded}
					<div class="mt-3 space-y-2 rounded-md bg-gray-50 p-3 dark:bg-gray-900/50">
						{#if entry.readyMessage}
							<div>
								<p class="text-xs font-medium text-gray-500 dark:text-gray-400">Message:</p>
								<p class="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
									{entry.readyMessage}
								</p>
							</div>
						{/if}
						{#if entry.errorMessage}
							<div>
								<p class="text-xs font-medium text-red-500 dark:text-red-400">Error:</p>
								<p class="mt-1 whitespace-pre-wrap text-sm text-red-700 dark:text-red-300">
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
			{#if index > 0 && onRollback && entry.specSnapshot}
				<button
					onclick={() => onRollback(entry.id, entry.revision)}
					class="text-sm font-medium text-primary transition-colors hover:text-primary/70"
					aria-label="Rollback to this revision"
				>
					Rollback
				</button>
			{:else if index === 0}
				<span class="text-xs text-gray-400 dark:text-gray-500">Current</span>
			{/if}
		</div>
	</div>
</div>
