<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';
	import { formatTimestamp } from '$lib/utils/flux';
	import StatusBadge from './StatusBadge.svelte';

	interface Props {
		resources: FluxResource[];
		showNamespace?: boolean;
		onCardClick?: (resource: FluxResource) => void;
	}

	let { resources, showNamespace = true, onCardClick }: Props = $props();

	function handleCardClick(resource: FluxResource) {
		if (onCardClick) {
			onCardClick(resource);
		}
	}

	function getReadyMessage(resource: FluxResource): string {
		const ready = resource.status?.conditions?.find((c) => c.type === 'Ready');
		return ready?.message || 'No status message';
	}
</script>

{#if resources.length === 0}
	<div
		class="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800"
	>
		<p class="text-sm text-gray-500 dark:text-gray-400">No resources found</p>
	</div>
{:else}
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each resources as resource}
			<button
				type="button"
				class="group rounded-lg border border-gray-200 bg-white p-4 text-left transition-all hover:border-gray-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
				onclick={() => handleCardClick(resource)}
			>
				<div class="flex items-start justify-between">
					<div class="min-w-0 flex-1">
						<h3
							class="truncate text-sm font-semibold text-gray-900 group-hover:text-blue-600 dark:text-gray-100 dark:group-hover:text-blue-400"
						>
							{resource.metadata.name}
						</h3>
						{#if showNamespace && resource.metadata.namespace}
							<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
								{resource.metadata.namespace}
							</p>
						{/if}
					</div>
					<div class="ml-2 flex-shrink-0">
						<StatusBadge
							conditions={resource.status?.conditions}
							suspended={resource.spec?.suspend as boolean | undefined}
						/>
					</div>
				</div>

				<p class="mt-3 line-clamp-2 text-xs text-gray-600 dark:text-gray-400">
					{getReadyMessage(resource)}
				</p>

				<div
					class="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-700"
				>
					<span class="text-xs text-gray-500 dark:text-gray-400">
						{formatTimestamp(resource.metadata.creationTimestamp)}
					</span>
				</div>
			</button>
		{/each}
	</div>
{/if}
