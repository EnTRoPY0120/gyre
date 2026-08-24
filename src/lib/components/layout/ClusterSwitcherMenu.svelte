<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { type ClusterOption } from '$lib/clusters/identity.js';
	import ClusterSwitcherItem from './ClusterSwitcherItem.svelte';

	let {
		availableClusters,
		currentCluster,
		selectingClusterId,
		onSelect
	}: {
		availableClusters: ClusterOption[];
		currentCluster: string;
		selectingClusterId: string | null;
		onSelect: (clusterId: string) => void;
	} = $props();
</script>

<DropdownMenu.Content
	align="end"
	class="w-64 border-border/50 bg-card/80 p-1.5 shadow-2xl backdrop-blur-xl"
>
	<DropdownMenu.Label
		class="px-3 py-3 text-[10px] font-black tracking-[0.2em] text-muted-foreground/50 uppercase"
		>Switch Infrastructure Context</DropdownMenu.Label
	>
	<DropdownMenu.Separator class="mb-1.5 opacity-30" />

	{#if availableClusters.length === 0}
		<!-- Skeleton loaders for cluster items -->
		<div class="space-y-1 px-1">
			{#each [1, 2, 3] as _, index (index)}
				<div class="flex items-center gap-3 rounded-xl px-3 py-3">
					<div class="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/20"></div>
					<div class="flex flex-1 flex-col gap-1.5">
						<div class="h-3 w-3/4 animate-pulse rounded bg-muted-foreground/10"></div>
						<div class="h-2 w-1/3 animate-pulse rounded bg-muted-foreground/5"></div>
					</div>
				</div>
			{/each}
		</div>
		<p class="mt-2 text-center text-[8px] text-muted-foreground/40">Fetching clusters...</p>
	{:else}
		{#each availableClusters as cluster (cluster.id)}
			<ClusterSwitcherItem
				{cluster}
				{currentCluster}
				{selectingClusterId}
				onSelect={onSelect}
			/>
		{/each}
	{/if}
</DropdownMenu.Content>
