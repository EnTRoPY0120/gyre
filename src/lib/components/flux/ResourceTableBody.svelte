<script lang="ts">
	import { PackageX } from '@lucide/svelte';
	import type { FluxResource } from '$lib/types/flux';
	import ResourceTableRow from './ResourceTableRow.svelte';

	let {
		resources,
		showAll,
		showNamespace,
		virtualRows,
		paginatedResources,
		topSpacerHeight,
		bottomSpacerHeight,
		selectedResourceIds,
		tbodyEl = $bindable(null),
		onRowClick,
		onToggleSelection
	}: {
		resources: FluxResource[];
		showAll: boolean;
		showNamespace: boolean;
		virtualRows: FluxResource[];
		paginatedResources: FluxResource[];
		topSpacerHeight: number;
		bottomSpacerHeight: number;
		selectedResourceIds: Set<string>;
		tbodyEl?: HTMLElement | null;
		onRowClick: (resource: FluxResource, event: MouseEvent) => void;
		onToggleSelection: (resource: FluxResource) => void;
	} = $props();

	let displayedResources = $derived(showAll ? virtualRows : paginatedResources);
</script>

<tbody class="divide-y divide-border/40" bind:this={tbodyEl}>
	{#if resources.length === 0}
		<tr>
			<td
				colspan={showNamespace ? 6 : 5}
				class="px-6 py-12 text-center text-sm text-muted-foreground"
			>
				<div class="flex flex-col items-center gap-3">
					<PackageX size={40} class="text-muted-foreground/40" />
					<p class="font-medium">No resources found</p>
					<p class="text-xs text-muted-foreground/60">
						Try adjusting your filters or checking connection.
					</p>
				</div>
			</td>
		</tr>
	{:else}
		{#if showAll && topSpacerHeight > 0}
			<tr style="height: {topSpacerHeight}px" aria-hidden="true">
				<td colspan={showNamespace ? 6 : 5}></td>
			</tr>
		{/if}
		{#each displayedResources as resource (resource.metadata.uid || '')}
			<ResourceTableRow
				{resource}
				{showNamespace}
				selected={!!resource.metadata.uid && selectedResourceIds.has(resource.metadata.uid)}
				onRowClick={(event) => onRowClick(resource, event)}
				onToggleSelection={() => onToggleSelection(resource)}
			/>
		{/each}
		{#if showAll && bottomSpacerHeight > 0}
			<tr style="height: {bottomSpacerHeight}px" aria-hidden="true">
				<td colspan={showNamespace ? 6 : 5}></td>
			</tr>
		{/if}
	{/if}
</tbody>
