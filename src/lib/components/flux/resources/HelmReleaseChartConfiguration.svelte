<script lang="ts">
	import type { HelmReleaseChart } from './helm-release-detail-types';

	let { chart }: { chart: HelmReleaseChart | undefined } = $props();
</script>


	<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Chart Configuration</h3>
		<dl class="grid gap-4 sm:grid-cols-2">
			{#if chart?.spec?.chart}
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
							{chart.spec.chart}
						</span>
					</dd>
				</div>
			{/if}

			{#if chart?.spec?.version}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Chart Version</dt>
					<dd class="mt-1">
						<span
							class="inline-flex items-center rounded-md bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900/50 dark:text-purple-300"
						>
							{chart.spec.version}
						</span>
					</dd>
				</div>
			{/if}

			{#if chart?.spec?.sourceRef}
				<div class="sm:col-span-2">
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Source Reference</dt>
					<dd class="mt-1 flex items-center gap-2">
						<span
							class="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300"
						>
							{chart.spec.sourceRef.kind}
						</span>
						<span class="text-sm text-gray-900 dark:text-gray-100">
							{chart.spec.sourceRef.name}
							{#if chart.spec.sourceRef.namespace}
								<span class="text-gray-500 dark:text-gray-400"
									>({chart.spec.sourceRef.namespace})</span
								>
							{/if}
						</span>
					</dd>
				</div>
			{/if}
		</dl>
	</div>
