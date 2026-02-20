<script lang="ts">
	import DependencyGraph from '$lib/components/graph/DependencyGraph.svelte';
	import type { FluxResource } from '$lib/server/kubernetes/flux/types';
	import type { ResourceRelationship } from '$lib/utils/relationships';

	interface Props {
		data: {
			allResources: FluxResource[];
			relationships: ResourceRelationship[];
			circularIds: string[];
			totalResources: number;
			totalRelationships: number;
		};
	}

	let { data }: Props = $props();
</script>

<svelte:head>
	<title>Dependency Graph — Gyre</title>
</svelte:head>

<div class="flex h-full flex-col">
	<!-- Page header -->
	<div class="flex items-center justify-between border-b border-border px-6 py-4">
		<div>
			<h1 class="text-xl font-bold tracking-tight text-foreground">Dependency Graph</h1>
			<p class="mt-0.5 text-sm text-muted-foreground">
				{data.totalResources} resources &middot; {data.totalRelationships} relationships
				{#if data.circularIds.length > 0}
					&middot; <span class="font-medium text-red-500"
						>{data.circularIds.length} circular {data.circularIds.length === 1
							? 'dependency'
							: 'dependencies'}</span
					>
				{/if}
			</p>
		</div>

		<!-- Legend -->
		<div class="hidden items-center gap-4 lg:flex">
			{#each [['source', '#3b82f6', 'Source ref'], ['uses', '#14b8a6', 'depends on / uses'], ['manages', '#a855f7', 'Manages'], ['triggers', '#f97316', 'Triggers'], ['notifies', '#ec4899', 'Notifies']] as [, color, label] (label)}
				<div class="flex items-center gap-1.5">
					<div class="h-0.5 w-6 rounded-full" style="background-color: {color};"></div>
					<span class="text-xs text-muted-foreground">{label}</span>
				</div>
			{/each}
		</div>
	</div>

	<!-- Graph -->
	<div class="min-h-0 flex-1">
		<DependencyGraph
			allResources={data.allResources}
			relationships={data.relationships}
			circularIds={data.circularIds}
			showControls={true}
		/>
	</div>
</div>
