<script lang="ts">
	import type { DashboardWidget } from '$lib/stores/dashboards.svelte';
	import { resourceCache } from '$lib/stores/resourceCache.svelte';
	import { FluxResourceType } from '$lib/types/flux';
	import StatusBadge from '$lib/components/flux/StatusBadge.svelte';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';

	let { widget, config }: { widget: DashboardWidget; config: Record<string, unknown> } = $props();

	// Use $derived to properly track reactive values
	let resourceType = $derived(widget.resourceType as FluxResourceType);
	let namespace = $derived((config?.namespace as string | undefined) || undefined);
	let limit = $derived((config?.limit as number) || 5);

	let resources = $derived(
		resourceType ? (resourceCache.getList(resourceType, namespace) || []).slice(0, limit) : []
	);

	onMount(async () => {
		if (resourceType && resources.length === 0) {
			await resourceCache.fetchList(resourceType, namespace);
		}
	});
</script>

<div class="space-y-2">
	{#if resources.length === 0}
		<div class="py-4 text-center text-xs text-muted-foreground italic">No resources found</div>
	{:else}
		{#each resources as r (r.metadata.uid)}
			<a
				href={resolve(
					`/resources/${resourceType}/${r.metadata.namespace || 'default'}/${r.metadata.name}`
				)}
				class="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/10 px-3 py-2 transition-all hover:bg-secondary/20"
			>
				<div class="flex min-w-0 flex-col">
					<span class="truncate text-[13px] font-bold tracking-tight">{r.metadata.name}</span>
					<span class="text-[10px] text-muted-foreground uppercase">{r.metadata.namespace}</span>
				</div>
				<div class="origin-right scale-75">
					<StatusBadge conditions={r.status?.conditions} suspended={!!r.spec?.suspend} size="sm" />
				</div>
			</a>
		{/each}
	{/if}
</div>
