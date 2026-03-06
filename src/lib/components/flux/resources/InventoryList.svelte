<script lang="ts">
	import StatusBadge from '../StatusBadge.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	import type { K8sCondition } from '$lib/types/flux';

	interface Props {
		resources: Array<{
			kind: string;
			metadata: { name: string; namespace: string; generation?: number };
			status?: { conditions?: K8sCondition[]; observedGeneration?: number };
			error?: string;
		}>;
	}

	let { resources }: Props = $props();

	// Group by Kind for cleaner display
	const groupedResources = $derived.by(() => {
		const groups: Record<string, typeof resources> = {};
		resources.forEach((r) => {
			const kind = r.kind || 'Unknown';
			if (!groups[kind]) groups[kind] = [];
			groups[kind].push(r);
		});
		return groups;
	});
</script>

<div class="overflow-hidden rounded-xl border border-border bg-card/60 shadow-sm backdrop-blur-sm">
	<div class="border-b border-border bg-muted/20 p-4">
		<h3 class="flex items-center gap-2 text-lg font-semibold">
			<Icon name="package" class="size-5 text-primary" />
			Managed Resources
			<span
				class="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground"
			>
				{resources.length} items
			</span>
		</h3>
	</div>

	{#if resources.length === 0}
		<div class="p-8 text-center text-sm text-muted-foreground">No inventory records found.</div>
	{:else}
		<div class="divide-y divide-border/50">
			{#each Object.entries(groupedResources) as [kind, items] (kind)}
				<div class="p-4">
					<h4
						class="mb-3 flex items-center gap-2 pl-1 text-xs font-black tracking-wider text-muted-foreground uppercase"
					>
						{kind}
					</h4>
					<div class="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
						{#each items as resource (resource.metadata.name)}
							<div
								class="group flex items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-3 transition-all hover:border-primary/30 hover:bg-accent/40"
							>
								<div
									class="flex size-8 items-center justify-center rounded-md bg-secondary/50 text-muted-foreground transition-colors group-hover:text-primary"
								>
									<span class="text-[10px] font-bold">{kind.substring(0, 2).toUpperCase()}</span>
								</div>

								<div class="min-w-0 flex-1">
									<div class="flex items-center justify-between">
										<p
											class="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary"
										>
											{resource.metadata.name}
										</p>
									</div>
									<p class="truncate text-[10px] text-muted-foreground">
										{resource.metadata.namespace}
									</p>
								</div>

								<!-- Live Status Indicator -->
								{#if resource.status?.conditions}
									<StatusBadge
										conditions={resource.status.conditions}
										observedGeneration={resource.status.observedGeneration}
										generation={resource.metadata.generation}
										size="sm"
									/>
								{:else if resource.error}
									<span
										class="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-500"
										>Err</span
									>
								{:else}
									<span class="size-2 rounded-full bg-zinc-700" title="No status"></span>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
