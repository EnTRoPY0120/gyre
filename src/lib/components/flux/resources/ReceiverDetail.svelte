<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';

	interface Props {
		resource: FluxResource;
	}

	let { resource }: Props = $props();

	const spec = $derived(resource.spec || {});
	const status = $derived(resource.status || {});

	const type = $derived(spec.type as string | undefined);
	const events = $derived(spec.events as string[] | undefined);
	const resources = $derived(
		spec.resources as Array<{ kind: string; name: string; namespace?: string; matchLabels?: Record<string, string> }> | undefined
	);
	const secretRef = $derived(spec.secretRef as { name: string } | undefined);
	const interval = $derived(spec.interval as string | undefined);
	const suspend = $derived(spec.suspend as boolean | undefined);

	// Status fields
	const webhookPath = $derived(
		(status as Record<string, unknown>).webhookPath as string | undefined
	);
</script>

<div class="space-y-6">
	<!-- Receiver Configuration -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
			Receiver Configuration
		</h3>
		<dl class="grid gap-4 sm:grid-cols-2">
			{#if type}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Receiver Type</dt>
					<dd class="mt-1">
						<span
							class="inline-flex items-center gap-1.5 rounded-md bg-indigo-100 px-2.5 py-1 text-sm font-medium text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
								/>
							</svg>
							{type}
						</span>
					</dd>
				</div>
			{/if}

			{#if interval}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Interval</dt>
					<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{interval}</dd>
				</div>
			{/if}

			{#if secretRef}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Token Secret</dt>
					<dd class="mt-1">
						<span
							class="inline-flex items-center gap-1 rounded-md bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300"
						>
							<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
								/>
							</svg>
							{secretRef.name}
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
		</dl>
	</div>

	<!-- Webhook Path -->
	{#if webhookPath}
		<div
			class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
		>
			<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Webhook Endpoint</h3>
			<div class="rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
				<code class="text-sm font-medium text-gray-900 dark:text-gray-100">{webhookPath}</code>
				<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
					Configure your source system to send webhooks to this path.
				</p>
			</div>
		</div>
	{/if}

	<!-- Watched Events -->
	{#if events && events.length > 0}
		<div
			class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
		>
			<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Watched Events</h3>
			<div class="flex flex-wrap gap-2">
				{#each events as event (event)}
					<span
						class="inline-flex items-center rounded-md bg-cyan-100 px-2 py-1 text-xs font-medium text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300"
					>
						{event}
					</span>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Watched Resources -->
	{#if resources && resources.length > 0}
		<div
			class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
		>
			<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
				Watched Resources
			</h3>
			<div class="space-y-2">
				{#each resources as res, i (i)}
					<div
						class="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700/50"
					>
						<span
							class="inline-flex items-center rounded-md bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/50 dark:text-purple-300"
						>
							{res.kind}
						</span>
						<span class="text-sm font-medium text-gray-900 dark:text-gray-100">
							{res.name === '*' ? 'All resources' : res.name}
						</span>
						{#if res.namespace}
							<span class="text-sm text-gray-500 dark:text-gray-400">in {res.namespace}</span>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
