<script lang="ts">
	import type { DashboardWidget } from '$lib/server/db/schema';
	import { resourceCache } from '$lib/stores/resourceCache.svelte';
	import { FluxResourceType, type K8sCondition } from '$lib/types/flux';
	import { onMount } from 'svelte';

	let { widget, config }: { widget: DashboardWidget; config: Record<string, unknown> } = $props();

	// Use $derived to properly track reactive values
	let resourceType = $derived(widget.resourceType as FluxResourceType);
	let namespace = $derived((config?.namespace as string | undefined) || undefined);

	// In a real app, we might need a dedicated API for counts if cache isn't warmed
	// For now, use the cache
	let resources = $derived(
		resourceType ? resourceCache.getList(resourceType, namespace) || [] : []
	);

	let count = $derived(resources.length);

	let readyCount = $derived(
		resources.filter((r) =>
			r.status?.conditions?.some((c: K8sCondition) => c.type === 'Ready' && c.status === 'True')
		).length
	);

	let errorCount = $derived(
		resources.filter((r) =>
			r.status?.conditions?.some((c: K8sCondition) => c.type === 'Ready' && c.status === 'False')
		).length
	);

	// If cache is empty, we should probably fetch
	onMount(async () => {
		if (resourceType && resources.length === 0) {
			await resourceCache.fetchList(resourceType, namespace);
		}
	});

	// Create a reverse mapping from enum value to enum key for display
	const typeLabel = $derived(() => {
		if (!resourceType) return '';
		// Find the enum key by its value
		const key = Object.keys(FluxResourceType).find(
			(k) => FluxResourceType[k as keyof typeof FluxResourceType] === resourceType
		);
		return key || resourceType;
	});
</script>

<div class="flex h-full flex-col justify-center">
	<div class="flex items-baseline gap-2">
		<span class="text-4xl font-black tracking-tight text-foreground">{count}</span>
		<span class="text-sm font-medium text-muted-foreground uppercase">{typeLabel()}</span>
	</div>

	<div class="mt-4 flex items-center gap-4">
		<div class="flex items-center gap-1.5">
			<div class="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
			<div class="flex flex-col">
				<span class="text-xs leading-none font-bold">{readyCount}</span>
				<span class="text-[10px] text-muted-foreground uppercase">Healthy</span>
			</div>
		</div>

		{#if errorCount > 0}
			<div class="flex items-center gap-1.5">
				<div class="size-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"></div>
				<div class="flex flex-col">
					<span class="text-xs leading-none font-bold">{errorCount}</span>
					<span class="text-[10px] text-muted-foreground uppercase">Errors</span>
				</div>
			</div>
		{/if}
	</div>
</div>
