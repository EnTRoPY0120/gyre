<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';

	interface Props {
		resource: FluxResource;
	}

	let { resource }: Props = $props();

	// Extract HelmRelease-specific fields
	const spec = $derived(resource.spec || {});
	const status = $derived(resource.status || {});

	const chart = $derived(spec.chart as { spec?: { chart?: string; version?: string; sourceRef?: { kind: string; name: string; namespace?: string } } } | undefined);
	const interval = $derived(spec.interval as string | undefined);
	const releaseName = $derived(spec.releaseName as string | undefined);
	const targetNamespace = $derived(spec.targetNamespace as string | undefined);
	const timeout = $derived(spec.timeout as string | undefined);
	const suspend = $derived(spec.suspend as boolean | undefined);
	const values = $derived(spec.values as Record<string, unknown> | undefined);
	const valuesFrom = $derived(spec.valuesFrom as Array<{ kind: string; name: string }> | undefined);

	// Status fields
	const lastAppliedRevision = $derived(status.lastAppliedRevision as string | undefined);
	const lastAttemptedRevision = $derived(status.lastAttemptedRevision as string | undefined);
	const helmChart = $derived((status as Record<string, unknown>).helmChart as string | undefined);
</script>

<div class="space-y-6">
	<!-- Chart Configuration -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Chart Configuration</h3>
		<dl class="grid gap-4 sm:grid-cols-2">
			{#if chart?.spec?.chart}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Chart Name</dt>
					<dd class="mt-1">
						<span class="inline-flex items-center gap-1.5 rounded-md bg-blue-100 px-2.5 py-1 text-sm font-medium text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
							</svg>
							{chart.spec.chart}
						</span>
					</dd>
				</div>
			{/if}

			{#if chart?.spec?.version}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Chart Version</dt>
					<dd class="mt-1">
						<span class="inline-flex items-center rounded-md bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
							{chart.spec.version}
						</span>
					</dd>
				</div>
			{/if}

			{#if chart?.spec?.sourceRef}
				<div class="sm:col-span-2">
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Source Reference</dt>
					<dd class="mt-1 flex items-center gap-2">
						<span class="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
							{chart.spec.sourceRef.kind}
						</span>
						<span class="text-sm text-gray-900 dark:text-gray-100">
							{chart.spec.sourceRef.name}
							{#if chart.spec.sourceRef.namespace}
								<span class="text-gray-500 dark:text-gray-400">({chart.spec.sourceRef.namespace})</span>
							{/if}
						</span>
					</dd>
				</div>
			{/if}
		</dl>
	</div>

	<!-- Release Configuration -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Release Configuration</h3>
		<dl class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#if releaseName}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Release Name</dt>
					<dd class="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{releaseName}</dd>
				</div>
			{/if}

			{#if targetNamespace}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Target Namespace</dt>
					<dd class="mt-1">
						<span class="inline-flex items-center rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/50 dark:text-green-300">
							{targetNamespace}
						</span>
					</dd>
				</div>
			{/if}

			{#if interval}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Reconcile Interval</dt>
					<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{interval}</dd>
				</div>
			{/if}

			{#if timeout}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Timeout</dt>
					<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{timeout}</dd>
				</div>
			{/if}

			{#if suspend !== undefined}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Suspended</dt>
					<dd class="mt-1">
						<span class="inline-flex rounded-md px-2 py-0.5 text-xs font-medium {suspend ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' : 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'}">
							{suspend ? 'Yes' : 'No'}
						</span>
					</dd>
				</div>
			{/if}
		</dl>
	</div>

	<!-- Release Status -->
	{#if lastAppliedRevision || lastAttemptedRevision || helmChart}
		<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
			<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Release Status</h3>
			<dl class="grid gap-4 sm:grid-cols-2">
				{#if lastAppliedRevision}
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Last Applied Revision</dt>
						<dd class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">{lastAppliedRevision}</dd>
					</div>
				{/if}

				{#if lastAttemptedRevision}
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Last Attempted Revision</dt>
						<dd class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">{lastAttemptedRevision}</dd>
					</div>
				{/if}

				{#if helmChart}
					<div class="sm:col-span-2">
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">HelmChart Reference</dt>
						<dd class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">{helmChart}</dd>
					</div>
				{/if}
			</dl>
		</div>
	{/if}

	<!-- Values From -->
	{#if valuesFrom && valuesFrom.length > 0}
		<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
			<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Values From</h3>
			<div class="flex flex-wrap gap-2">
				{#each valuesFrom as source}
					<span class="inline-flex items-center gap-1.5 rounded-md bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300">
						<span class="text-yellow-600 dark:text-yellow-400">{source.kind}:</span>
						{source.name}
					</span>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Inline Values Preview -->
	{#if values && Object.keys(values).length > 0}
		<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
			<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Inline Values</h3>
			<pre class="overflow-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100"><code>{JSON.stringify(values, null, 2)}</code></pre>
		</div>
	{/if}
</div>
