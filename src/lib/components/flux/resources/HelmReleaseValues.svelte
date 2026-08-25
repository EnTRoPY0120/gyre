<script lang="ts">
	import type { HelmReleaseValuesFrom } from './helm-release-detail-types';

	let {
		valuesFrom,
		values
	}: {
		valuesFrom: HelmReleaseValuesFrom[] | undefined;
		values: Record<string, unknown> | undefined;
	} = $props();
</script>

{#if valuesFrom && valuesFrom.length > 0}
	<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Values From</h3>
		<div class="flex flex-wrap gap-2">
			{#each valuesFrom as source (source.name)}
				<span
					class="inline-flex items-center gap-1.5 rounded-md bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300"
				>
					<span class="text-yellow-600 dark:text-yellow-400">{source.kind}:</span>
					{source.name}
				</span>
			{/each}
		</div>
	</div>
{/if}

{#if values && Object.keys(values).length > 0}
	<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Inline Values</h3>
		<pre class="overflow-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100"><code
				>{JSON.stringify(values, null, 2)}</code
			></pre>
	</div>
{/if}
