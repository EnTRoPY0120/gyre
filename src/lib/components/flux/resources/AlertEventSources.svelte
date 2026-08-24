<script lang="ts">
	import type { AlertEventSource } from './alert-detail-types';

	let { eventSources }: { eventSources: AlertEventSource[] | undefined } = $props();
</script>

{#if eventSources && eventSources.length > 0}
	<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Event Sources</h3>
		<div class="space-y-2">
			{#each eventSources as source (source.kind + (source.namespace ?? '') + source.name)}
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
