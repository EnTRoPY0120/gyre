<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';

	interface Props {
		resource: FluxResource;
	}

	let { resource }: Props = $props();

	const spec = $derived(resource.spec || {});

	const providerRef = $derived(spec.providerRef as { name: string } | undefined);
	const eventSeverity = $derived(spec.eventSeverity as string | undefined);
	const eventSources = $derived(
		spec.eventSources as
			| Array<{
					kind: string;
					name: string;
					namespace?: string;
					matchLabels?: Record<string, string>;
			  }>
			| undefined
	);
	const inclusionList = $derived(spec.inclusionList as string[] | undefined);
	const exclusionList = $derived(spec.exclusionList as string[] | undefined);
	const summary = $derived(spec.summary as string | undefined);
	const suspend = $derived(spec.suspend as boolean | undefined);
</script>

<div class="space-y-6">
	<!-- Alert Configuration -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
			Alert Configuration
		</h3>
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
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Suspended</dt>
					<dd class="mt-1">
						<span
							class="inline-flex rounded-md px-2 py-0.5 text-xs font-medium {suspend
								? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
								: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'}"
						>
							{suspend ? 'Yes' : 'No'}
						</span>
					</dd>
				</div>
			{/if}

			{#if summary}
				<div class="sm:col-span-2">
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Summary</dt>
					<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{summary}</dd>
				</div>
			{/if}
		</dl>
	</div>

	<!-- Event Sources -->
	{#if eventSources && eventSources.length > 0}
		<div
			class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
		>
			<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Event Sources</h3>
			<div class="space-y-2">
				{#each eventSources as source, i (i)}
					<div
						class="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700/50"
					>
						<span
							class="inline-flex items-center rounded-md bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/50 dark:text-purple-300"
						>
							{source.kind}
						</span>
						<span class="text-sm font-medium text-gray-900 dark:text-gray-100">
							{source.name === '*' ? 'All resources' : source.name}
						</span>
						{#if source.namespace}
							<span class="text-sm text-gray-500 dark:text-gray-400">in {source.namespace}</span>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Inclusion/Exclusion Filters -->
	{#if (inclusionList && inclusionList.length > 0) || (exclusionList && exclusionList.length > 0)}
		<div
			class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
		>
			<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Event Filters</h3>
			<div class="space-y-4">
				{#if inclusionList && inclusionList.length > 0}
					<div>
						<h4 class="mb-2 text-sm font-medium text-green-700 dark:text-green-400">
							Include (match any)
						</h4>
						<div class="flex flex-wrap gap-2">
							{#each inclusionList as pattern (pattern)}
								<span
									class="inline-flex items-center rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/50 dark:text-green-300"
								>
									{pattern}
								</span>
							{/each}
						</div>
					</div>
				{/if}
				{#if exclusionList && exclusionList.length > 0}
					<div>
						<h4 class="mb-2 text-sm font-medium text-red-700 dark:text-red-400">
							Exclude (skip matching)
						</h4>
						<div class="flex flex-wrap gap-2">
							{#each exclusionList as pattern (pattern)}
								<span
									class="inline-flex items-center rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-800 dark:bg-red-900/50 dark:text-red-300"
								>
									{pattern}
								</span>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
