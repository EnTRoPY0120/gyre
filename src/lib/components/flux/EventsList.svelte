<script lang="ts">
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
		events: K8sEvent[];
		loading?: boolean;
		error?: string | null;
	}

	let { events, loading = false, error = null }: Props = $props();

	// Filter state
	let filterType = $state<'all' | 'Normal' | 'Warning'>('all');

	const filteredEvents = $derived(
		filterType === 'all' ? events : events.filter((e) => e.type === filterType)
	);

	const warningCount = $derived(events.filter((e) => e.type === 'Warning').length);
	const normalCount = $derived(events.filter((e) => e.type === 'Normal').length);

	// Format event timestamp as relative time
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

<div class="space-y-4">
	<!-- Filter Tabs -->
	<div class="flex items-center gap-2">
		<button
			type="button"
			class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors {filterType === 'all'
				? 'bg-gray-900 text-white'
				: 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
			onclick={() => (filterType = 'all')}
		>
			All ({events.length})
		</button>
		<button
			type="button"
			class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors {filterType === 'Warning'
				? 'bg-red-600 text-white'
				: 'bg-red-50 text-red-700 hover:bg-red-100'}"
			onclick={() => (filterType = 'Warning')}
		>
			Warnings ({warningCount})
		</button>
		<button
			type="button"
			class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors {filterType === 'Normal'
				? 'bg-green-600 text-white'
				: 'bg-green-50 text-green-700 hover:bg-green-100'}"
			onclick={() => (filterType = 'Normal')}
		>
			Normal ({normalCount})
		</button>
	</div>

	<!-- Loading State -->
	{#if loading}
		<div class="flex items-center justify-center py-12">
			<svg class="h-8 w-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
				></circle>
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				></path>
			</svg>
		</div>
	{:else if error}
		<!-- Error State -->
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
				<p class="text-sm text-red-700">{error}</p>
			</div>
		</div>
	{:else if filteredEvents.length === 0}
		<!-- Empty State -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<svg class="h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<p class="mt-4 text-sm text-gray-500">
				{filterType === 'all' ? 'No events found for this resource' : `No ${filterType.toLowerCase()} events`}
			</p>
		</div>
	{:else}
		<!-- Events List -->
		<div class="space-y-3">
			{#each filteredEvents as event}
				<div
					class="rounded-lg border p-4 {event.type === 'Warning'
						? 'border-red-200 bg-red-50'
						: 'border-gray-200 bg-white'}"
				>
					<div class="flex items-start justify-between gap-4">
						<div class="flex-1">
							<div class="flex items-center gap-2">
								<!-- Event Type Badge -->
								<span
									class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {event.type ===
									'Warning'
										? 'bg-red-100 text-red-800'
										: 'bg-green-100 text-green-800'}"
								>
									{#if event.type === 'Warning'}
										<svg
											class="-ml-0.5 mr-1 h-3 w-3"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
											/>
										</svg>
									{:else}
										<svg
											class="-ml-0.5 mr-1 h-3 w-3"
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

								<!-- Reason -->
								<span class="font-medium text-gray-900">{event.reason}</span>

								<!-- Count Badge -->
								{#if event.count > 1}
									<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
										×{event.count}
									</span>
								{/if}
							</div>

							<!-- Message -->
							<p class="mt-1 text-sm text-gray-600">{event.message}</p>

							<!-- Source -->
							<p class="mt-2 text-xs text-gray-400">
								Source: {event.source.component}
							</p>
						</div>

						<!-- Timestamp -->
						<div class="text-right text-xs text-gray-400">
							<p>{formatEventTime(event.lastTimestamp)}</p>
							{#if event.count > 1 && event.firstTimestamp}
								<p class="mt-1">First: {formatEventTime(event.firstTimestamp)}</p>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
