<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';
	import { formatTimestamp } from '$lib/utils/flux';

	interface Props {
		resource: FluxResource;
	}

	let { resource }: Props = $props();

	// Extract HelmChart-specific fields
	const spec = $derived(resource.spec || {});
	const status = $derived(resource.status || {});

	const chart = $derived(spec.chart as string | undefined);
	const version = $derived(spec.version as string | undefined);
	const interval = $derived(spec.interval as string | undefined);
	const sourceRef = $derived(
		spec.sourceRef as { kind: string; name: string; namespace?: string } | undefined
	);
	const valuesFiles = $derived(spec.valuesFiles as string[] | undefined);
	const valuesFile = $derived(spec.valuesFile as string | undefined);
	const reconcileStrategy = $derived(spec.reconcileStrategy as string | undefined);
	const suspend = $derived(spec.suspend as boolean | undefined);

	// Artifact info from status
	const artifact = $derived(
		status.artifact as
			| {
					path?: string;
					url?: string;
					revision?: string;
					lastUpdateTime?: string;
			  }
			| undefined
	);
	const observedChartName = $derived(
		(status as Record<string, unknown>).observedChartName as string | undefined
	);
</script>

<div class="space-y-6">
	<!-- Chart Configuration -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
			Chart Configuration
		</h3>
		<dl class="grid gap-4 sm:grid-cols-2">
			{#if chart}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Chart Name</dt>
					<dd class="mt-1">
						<span
							class="inline-flex items-center gap-1.5 rounded-md bg-blue-100 px-2.5 py-1 text-sm font-medium text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
								/>
							</svg>
							{chart}
						</span>
					</dd>
				</div>
			{/if}

			{#if version}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Version Constraint</dt>
					<dd class="mt-1">
						<span
							class="inline-flex items-center rounded-md bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900/50 dark:text-purple-300"
						>
							{version}
						</span>
					</dd>
				</div>
			{/if}

			{#if sourceRef}
				<div class="sm:col-span-2">
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Source Reference</dt>
					<dd class="mt-1 flex items-center gap-2">
						<span
							class="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300"
						>
							{sourceRef.kind}
						</span>
						<span class="text-sm text-gray-900 dark:text-gray-100">
							{sourceRef.name}
							{#if sourceRef.namespace}
								<span class="text-gray-500 dark:text-gray-400">({sourceRef.namespace})</span>
							{/if}
						</span>
					</dd>
				</div>
			{/if}

			{#if interval}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Sync Interval</dt>
					<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{interval}</dd>
				</div>
			{/if}

			{#if reconcileStrategy}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
						Reconcile Strategy
					</dt>
					<dd class="mt-1">
						<span
							class="inline-flex items-center rounded-md bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800 dark:bg-orange-900/50 dark:text-orange-300"
						>
							{reconcileStrategy}
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

	<!-- Values Files -->
	{#if (valuesFiles && valuesFiles.length > 0) || valuesFile}
		<div
			class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
		>
			<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Values Files</h3>
			<div class="space-y-2">
				{#if valuesFile}
					<div class="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700/50">
						<svg
							class="h-4 w-4 text-gray-400 dark:text-gray-500"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/>
						</svg>
						<code class="text-sm text-gray-900 dark:text-gray-100">{valuesFile}</code>
					</div>
				{/if}
				{#if valuesFiles}
					{#each valuesFiles as file (file)}
						<div
							class="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700/50"
						>
							<svg
								class="h-4 w-4 text-gray-400 dark:text-gray-500"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
								/>
							</svg>
							<code class="text-sm text-gray-900 dark:text-gray-100">{file}</code>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	{/if}

	<!-- Latest Artifact -->
	{#if artifact}
		<div
			class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
		>
			<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Latest Artifact</h3>
			<dl class="grid gap-4 sm:grid-cols-2">
				{#if artifact.revision}
					<div class="sm:col-span-2">
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Revision</dt>
						<dd class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">
							{artifact.revision}
						</dd>
					</div>
				{/if}

				{#if observedChartName}
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
							Observed Chart Name
						</dt>
						<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{observedChartName}</dd>
					</div>
				{/if}

				{#if artifact.lastUpdateTime}
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Last Updated</dt>
						<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
							{formatTimestamp(artifact.lastUpdateTime)}
						</dd>
					</div>
				{/if}
			</dl>
		</div>
	{/if}
</div>
