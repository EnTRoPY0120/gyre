<script lang="ts">
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import { clusterStore } from "$lib/stores/cluster.svelte";
	import Icon from "$lib/components/ui/Icon.svelte";
	import { cn } from "$lib/utils";

	interface Props {
		current?: string;
		available?: string[];
	}

	let { current, available = [] }: Props = $props();

	const currentCluster = $derived(current || clusterStore.current || 'default');
	const availableClusters = $derived(available?.length > 0 ? available : clusterStore.available);

	function selectCluster(name: string) {
		if (name === currentCluster) return;
		clusterStore.setCluster(name);
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger class="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/40 hover:bg-card/60 transition-all text-xs font-medium group">
		<div class="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)] group-hover:scale-110 transition-transform"></div>
		<span class="max-w-[150px] truncate font-mono text-[10px] tracking-tight">{currentCluster}</span>
		<Icon name="chevron-down" size={12} class="text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end" class="w-64 backdrop-blur-xl bg-card/80 border-border/50 shadow-2xl p-1.5">
		<DropdownMenu.Label class="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 px-3 py-3">Switch Infrastructure Context</DropdownMenu.Label>
		<DropdownMenu.Separator class="mb-1.5 opacity-30" />
		
		{#if availableClusters.length === 0}
			<div class="px-3 py-4 text-center">
				<Icon name="loader" size={16} class="mx-auto mb-2 animate-spin text-muted-foreground/40" />
				<p class="text-[10px] text-muted-foreground/60">Fetching available contexts...</p>
			</div>
		{:else}
			{#each availableClusters as cluster}
				<DropdownMenu.Item 
					onSelect={() => selectCluster(cluster)} 
					class={cn(
						"gap-3 cursor-pointer py-3 px-3 transition-colors rounded-xl mb-0.5 last:mb-0",
						cluster === currentCluster ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-accent/50"
					)}
				>
					<div class={cn(
						"h-1.5 w-1.5 rounded-full transition-all duration-300",
						cluster === currentCluster ? "bg-green-500 scale-150 ring-4 ring-green-500/20" : "bg-muted-foreground/20"
					)}></div>
					<div class="flex flex-col gap-0.5 flex-1 overflow-hidden">
						<span class={cn(
							"font-mono text-[11px] truncate",
							cluster === currentCluster ? "text-foreground font-bold" : "text-muted-foreground"
						)}>{cluster}</span>
						{#if cluster === currentCluster}
							<span class="text-[8px] font-black uppercase tracking-widest text-green-500/60">Active Context</span>
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
