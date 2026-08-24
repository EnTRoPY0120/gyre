<script lang="ts">
	import DetailField from '$lib/components/flux/details/DetailField.svelte';
	import SuspendedBadge from '$lib/components/flux/details/SuspendedBadge.svelte';

	let {
		providerRef,
		eventSeverity,
		suspend,
		summary
	}: {
		providerRef: { name: string } | undefined;
		eventSeverity: string | undefined;
		suspend: boolean | undefined;
		summary: string | undefined;
	} = $props();
</script>

<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
	<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Alert Configuration</h3>
	<dl class="grid gap-4 sm:grid-cols-2">
		{#if providerRef}
			<div>
				<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
					Notification Provider
				</dt>
				<dd class="mt-1">
					<span
						class="inline-flex items-center gap-1.5 rounded-md bg-blue-100 px-2.5 py-1 text-sm font-medium text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
							/>
						</svg>
						{providerRef.name}
					</span>
				</dd>
			</div>
		{/if}

		{#if eventSeverity}
			<div>
				<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Event Severity</dt>
				<dd class="mt-1">
					<span
						class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium {eventSeverity ===
						'error'
							? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
							: eventSeverity === 'info'
								? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
								: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}"
					>
						{eventSeverity}
					</span>
				</dd>
			</div>
		{/if}

		{#if suspend !== undefined}
			<DetailField label="Suspended">
				<SuspendedBadge suspended={suspend} />
			</DetailField>
		{/if}

		{#if summary}
			<div class="sm:col-span-2">
				<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Summary</dt>
				<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{summary}</dd>
			</div>
		{/if}
	</dl>
</div>
