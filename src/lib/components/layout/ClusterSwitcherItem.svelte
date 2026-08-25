<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { type ClusterOption } from '$lib/clusters/identity.js';
	import { eventsStore } from '$lib/stores/events.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { cn } from '$lib/utils';

	let {
		cluster,
		currentCluster,
		selectingClusterId,
		onSelect
	}: {
		cluster: ClusterOption;
		currentCluster: string;
		selectingClusterId: string | null;
		onSelect: (clusterId: string) => void;
	} = $props();
</script>

<DropdownMenu.Item
	onSelect={() => onSelect(cluster.id)}
	class={cn(
		'mb-0.5 cursor-pointer gap-3 rounded-xl px-3 py-3 transition-colors last:mb-0',
		selectingClusterId ? 'pointer-events-none opacity-60' : '',
		cluster.id === currentCluster ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-accent/50'
	)}
>
	<div
		aria-hidden="true"
		class={cn(
			'h-1.5 w-1.5 rounded-full transition-all duration-300',
			cluster.id === currentCluster
				? 'scale-150 bg-green-500 ring-4 ring-green-500/20'
				: 'bg-muted-foreground/20'
		)}
	></div>
	<div class="flex flex-1 flex-col gap-0.5 overflow-hidden">
		<span
			class={cn(
				'truncate font-mono text-[11px]',
				cluster.id === currentCluster ? 'font-bold text-foreground' : 'text-muted-foreground'
			)}>{cluster.name}</span
		>
		{#if cluster.id === currentCluster}
			<span class="text-[8px] font-black tracking-widest text-green-500/60 uppercase"
				>Active Context</span
			>
		{:else if cluster.description}
			<span class="truncate text-[9px] text-muted-foreground/60">{cluster.description}</span>
		{/if}
	</div>
	{#if eventsStore.clusterUnreadCounts[cluster.id] > 0}
		<span
			class="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm"
		>
			{eventsStore.clusterUnreadCounts[cluster.id]}
		</span>
	{/if}
	{#if selectingClusterId === cluster.id}
		<Icon name="loader-2" size={12} class="animate-spin text-muted-foreground" />
	{:else if cluster.id === currentCluster}
		<Icon name="check" size={12} class="text-green-500" />
	{/if}
</DropdownMenu.Item>
