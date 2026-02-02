<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';
	import { formatTimestamp, getResourceHealth } from '$lib/utils/flux';
	import StatusBadge from './StatusBadge.svelte';

	interface Props {
		resources: FluxResource[];
		showNamespace?: boolean;
		onRowClick?: (resource: FluxResource) => void;
	}

	let { resources, showNamespace = true, onRowClick }: Props = $props();

	function handleRowClick(resource: FluxResource) {
		if (onRowClick) {
			onRowClick(resource);
		}
	}

	function getReadyMessage(resource: FluxResource): string {
		const ready = resource.status?.conditions?.find((c) => c.type === 'Ready');
		return ready?.message || '-';
	}
</script>

<div
	class="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
>
	<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
		<thead class="bg-gray-50 dark:bg-gray-800">
			<tr>
				<th
					class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
				>
					Name
				</th>
				{#if showNamespace}
					<th
						class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>
						Namespace
					</th>
				{/if}
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
					Status
				</th>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
					Age
				</th>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
					Message
				</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
			{#if resources.length === 0}
				<tr>
					<td
						colspan={showNamespace ? 5 : 4}
						class="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
					>
						No resources found
					</td>
				</tr>
			{:else}
				{#each resources as resource}
					<tr
						class="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
						onclick={() => handleRowClick(resource)}
					>
						<td class="px-6 py-4 whitespace-nowrap">
							<div class="text-sm font-medium text-gray-900 dark:text-gray-100">
								{resource.metadata.name}
							</div>
						</td>
						{#if showNamespace}
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm text-gray-500 dark:text-gray-400">
									{resource.metadata.namespace || '-'}
								</div>
							</td>
						{/if}
						<td class="px-6 py-4 whitespace-nowrap">
							<StatusBadge
								conditions={resource.status?.conditions}
								suspended={resource.spec?.suspend as boolean | undefined}
							/>
						</td>
						<td class="px-6 py-4 whitespace-nowrap">
							<div class="text-sm text-gray-500 dark:text-gray-400">
								{formatTimestamp(resource.metadata.creationTimestamp)}
							</div>
						</td>
						<td class="px-6 py-4">
							<div class="max-w-md text-sm text-gray-500 dark:text-gray-400">
								{getReadyMessage(resource)}
							</div>
						</td>
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>
