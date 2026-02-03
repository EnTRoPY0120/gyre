<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { clusterStore } from '$lib/stores/cluster.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { cn } from '$lib/utils';

	interface Props {
		current?: string;
		available?: string[];
	}

	let { current, available }: Props = $props();

	const currentCluster = $derived(current || clusterStore.current || 'default');
	// Merge prop data with store data, preferring store if it has data
	const availableClusters = $derived(
		clusterStore.available.length > 0 ? clusterStore.available : (available ?? [])
	);

	function selectCluster(name: string) {
		if (name === currentCluster) return;
		clusterStore.setCluster(name);
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger
		class="group flex items-center gap-2 rounded-md border border-transparent bg-secondary/50 px-3 py-1.5 text-xs font-medium transition-all hover:border-border hover:bg-secondary/80"
	>
		<div
			class="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] transition-transform group-hover:scale-125"
		></div>
		<span class="max-w-[150px] truncate font-mono text-[10px] tracking-tight">{currentCluster}</span
		>
		<Icon
			name="chevron-down"
			size={12}
			class="text-muted-foreground/50 transition-colors group-hover:text-foreground"
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
				{#each [1, 2, 3] as _}
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
				Fetching cluster contexts...
			</p>
		{:else}
			{#each availableClusters as cluster}
				<DropdownMenu.Item
					onSelect={() => selectCluster(cluster)}
					class={cn(
						'mb-0.5 cursor-pointer gap-3 rounded-xl px-3 py-3 transition-colors last:mb-0',
						cluster === currentCluster ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-accent/50'
					)}
				>
					<div
						class={cn(
							'h-1.5 w-1.5 rounded-full transition-all duration-300',
							cluster === currentCluster
								? 'scale-150 bg-green-500 ring-4 ring-green-500/20'
								: 'bg-muted-foreground/20'
						)}
					></div>
					<div class="flex flex-1 flex-col gap-0.5 overflow-hidden">
						<span
							class={cn(
								'truncate font-mono text-[11px]',
								cluster === currentCluster ? 'font-bold text-foreground' : 'text-muted-foreground'
							)}>{cluster}</span
						>
						{#if cluster === currentCluster}
							<span class="text-[8px] font-black tracking-widest text-green-500/60 uppercase"
								>Active Context</span
							>
						{/if}
					</div>
					{#if cluster === currentCluster}
						<Icon name="check" size={12} class="text-green-500" />
					{/if}
				</DropdownMenu.Item>
			{/each}
		{/if}
	</DropdownMenu.Content>
</DropdownMenu.Root>
