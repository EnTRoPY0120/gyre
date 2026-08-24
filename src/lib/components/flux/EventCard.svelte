<script lang="ts">
	import type { K8sEvent } from './events-list-types';

	let { event }: { event: K8sEvent } = $props();

	function formatEventTime(timestamp: string | null): string {
		if (!timestamp) return 'Unknown';

		const now = new Date();
		const eventTime = new Date(timestamp);
		const diffMs = now.getTime() - eventTime.getTime();
		const diffSeconds = Math.floor(diffMs / 1000);
		const diffMinutes = Math.floor(diffSeconds / 60);
		const diffHours = Math.floor(diffMinutes / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffSeconds < 60) return `${diffSeconds}s ago`;
		if (diffMinutes < 60) return `${diffMinutes}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;

		return eventTime.toLocaleDateString();
	}
</script>

<div class="px-1 py-1.5">
	<div
		class="h-[125px] overflow-hidden rounded-lg border p-4 transition-all hover:border-primary/30 {event.type ===
		'Warning'
			? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
			: 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'}"
	>
		<div class="flex items-start justify-between gap-4">
			<div class="flex-1">
				<div class="flex items-center gap-2">
					<span
						class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {event.type ===
							'Warning'
							? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
							: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'}"
					>
						{#if event.type === 'Warning'}
							<svg
								class="mr-1 -ml-0.5 h-3 w-3"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77-1.333.192 3.732 1.732 3z"
								/>
							</svg>
						{:else}
							<svg
								class="mr-1 -ml-0.5 h-3 w-3"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M5 13l4 4L19 7"
								/>
							</svg>
						{/if}
						{event.type}
					</span>
					<span class="font-medium text-gray-900 dark:text-gray-100">{event.reason}</span>
					{#if event.count > 1}
						<span
							class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400"
						>
							×{event.count}
						</span>
					{/if}
				</div>
				<p class="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">{event.message}</p>
				<p class="mt-2 text-xs text-gray-400 dark:text-gray-500">
					Source: {event.source.component}
				</p>
			</div>
			<div class="text-right text-xs text-gray-400 dark:text-gray-500">
				<p>{formatEventTime(event.lastTimestamp)}</p>
				{#if event.count > 1 && event.firstTimestamp}
					<p class="mt-1">First: {formatEventTime(event.firstTimestamp)}</p>
				{/if}
			</div>
		</div>
	</div>
</div>
