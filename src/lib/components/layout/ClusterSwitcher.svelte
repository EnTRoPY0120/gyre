<script lang="ts">
	/* eslint-disable @typescript-eslint/no-unused-vars */
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { IN_CLUSTER_ID, type ClusterOption } from '$lib/clusters/identity.js';
	import { clusterStore } from '$lib/stores/cluster.svelte';
	import { eventsStore } from '$lib/stores/events.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { cn } from '$lib/utils';
	import ClusterSwitcherMenu from './ClusterSwitcherMenu.svelte';

	interface Props {
		currentId?: string;
		available?: ClusterOption[];
		connected?: boolean;
	}

	let { currentId, available, connected = true }: Props = $props();

	const currentCluster = $derived(currentId || clusterStore.current || IN_CLUSTER_ID);
	// Merge prop data with store data, preferring store if it has data
	const availableClusters = $derived(
		clusterStore.available.length > 0 ? clusterStore.available : (available ?? [])
	);
	const selectedCluster = $derived(
		availableClusters.find((cluster) => cluster.id === currentCluster) ?? null
	);
	let selectingClusterId = $state<string | null>(null);

	async function selectCluster(clusterId: string) {
		if (clusterId === currentCluster || selectingClusterId) return;
		selectingClusterId = clusterId;
		try {
			await clusterStore.setCluster(clusterId);
		} finally {
			selectingClusterId = null;
		}
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger
		class="group flex items-center gap-1.5 rounded-md border border-transparent bg-secondary/50 px-2 py-1 text-xs font-medium transition-all hover:border-border hover:bg-secondary/80 sm:gap-2 sm:px-3 sm:py-1.5"
		aria-label={`Current cluster: ${selectedCluster?.name ?? currentCluster}. Click to switch cluster`}
	>
		<div
			aria-hidden="true"
			class={cn(
				'h-1.5 w-1.5 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)] transition-transform group-hover:scale-125',
				connected ? 'bg-emerald-500' : 'bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.4)]'
			)}
		></div>
		<span
			class="xs:max-w-[100px] max-w-[60px] truncate font-mono text-[9px] tracking-tight sm:max-w-[150px] sm:text-[10px]"
			>{selectedCluster?.name ?? currentCluster}</span
		>
		{#if eventsStore.clusterUnreadCounts[currentCluster] > 0}
			<span
				class="ml-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white shadow-sm sm:h-4 sm:min-w-[16px] sm:text-[9px]"
			>
				{eventsStore.clusterUnreadCounts[currentCluster] > 9
					? '9+'
					: eventsStore.clusterUnreadCounts[currentCluster]}
			</span>
		{/if}
		<Icon
			name="chevron-down"
			size={10}
			class="text-muted-foreground/50 transition-colors group-hover:text-foreground sm:size-3"
		/>
	</DropdownMenu.Trigger>
	<ClusterSwitcherMenu
		{availableClusters}
		{currentCluster}
		{selectingClusterId}
		onSelect={selectCluster}
	/>
</DropdownMenu.Root>
