<script lang="ts">
	import type { OCILayerSelector as OCILayerSelectorData } from './oci-repository-detail-types';

	let { layerSelector }: { layerSelector: OCILayerSelectorData } = $props();
</script>

<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
	<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Layer Selector</h3>
	<dl class="grid gap-4 sm:grid-cols-2">
		{#if layerSelector.mediaType}
			<div>
				<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Media Type</dt>
				<dd class="mt-1">
					<code
						class="rounded bg-gray-100 px-2 py-1 text-sm text-gray-800 dark:bg-gray-700 dark:text-gray-200"
						>{layerSelector.mediaType}</code
					>
				</dd>
			</div>
		{/if}
		{#if layerSelector.operation}
			<div>
				<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Operation</dt>
				<dd class="mt-1">
					<span
						class="inline-flex items-center rounded-md bg-violet-100 px-2 py-1 text-xs font-medium text-violet-800 dark:bg-violet-900/50 dark:text-violet-300"
					>
						{layerSelector.operation}
					</span>
				</dd>
			</div>
		{/if}
	</dl>
</div>
