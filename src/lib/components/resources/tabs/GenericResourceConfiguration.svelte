<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';
	import GenericResourceValue from './GenericResourceValue.svelte';

	let { spec }: { spec: FluxResource['spec'] } = $props();
</script>

{#if spec}
	<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Configuration</h3>
		<dl class="grid gap-4 sm:grid-cols-2">
			{#each Object.entries(spec).slice(0, 9) as [key, value], index (index)}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">{key}</dt>
					<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
						<GenericResourceValue {value} />
					</dd>
				</div>
			{/each}
		</dl>
	</div>
{/if}
