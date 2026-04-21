<script lang="ts">
	/* eslint-disable @typescript-eslint/no-unused-vars */
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { IN_CLUSTER_ID, type ClusterOption } from '$lib/clusters/identity.js';
	import { clusterStore } from '$lib/stores/cluster.svelte';
	import { eventsStore } from '$lib/stores/events.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { cn } from '$lib/utils';

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
		eventsStore.disconnect();
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
			<p class="mt-2 text-center text-[8px] text-muted-foreground/40">
				Fetching clusters...
			</p>
		{:else}
			{#each availableClusters as cluster (cluster.id)}
				<DropdownMenu.Item
					onSelect={() => selectCluster(cluster.id)}
					class={cn(
						'mb-0.5 cursor-pointer gap-3 rounded-xl px-3 py-3 transition-colors last:mb-0',
						selectingClusterId ? 'pointer-events-none opacity-60' : '',
						cluster.id === currentCluster
							? 'bg-primary/5 hover:bg-primary/10'
							: 'hover:bg-accent/50'
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
								cluster.id === currentCluster
									? 'font-bold text-foreground'
									: 'text-muted-foreground'
							)}>{cluster.name}</span
						>
						{#if cluster.id === currentCluster}
							<span class="text-[8px] font-black tracking-widest text-green-500/60 uppercase"
								>Active Context</span
							>
						{:else if cluster.description}
							<span class="truncate text-[9px] text-muted-foreground/60">
								{cluster.description}
							</span>
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
			{/each}
		{/if}
	</DropdownMenu.Content>
</DropdownMenu.Root>
