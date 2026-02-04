<script lang="ts">
	import type { DashboardWidget } from '$lib/stores/dashboards.svelte';
	import { resourceCache } from '$lib/stores/resourceCache.svelte';
	import { FluxResourceType } from '$lib/types/flux';

	interface FluxResource {
		spec?: { suspend?: boolean };
		status?: { conditions?: Array<{ type: string; status: string }> };
	}

	let { widget, config }: { widget: DashboardWidget; config: Record<string, unknown> } = $props();

	// Use $derived to properly track reactive values
	// If no resourceType is specified, aggregate across a fixed set
	let resourceTypes = $derived(
		(config?.resourceTypes as string[]) ||
			(widget.resourceType
				? [widget.resourceType]
				: [
						FluxResourceType.GitRepository,
						FluxResourceType.Kustomization,
						FluxResourceType.HelmRelease
					])
	);

	let stats = $derived(() => {
		let total = 0;
		let healthy = 0;
		let error = 0;
		let suspended = 0;

		resourceTypes.forEach((type: string) => {
			const list = resourceCache.getList(type as FluxResourceType) || [];
			list.forEach((r: FluxResource) => {
				total++;
				if (r.spec?.suspend) {
					suspended++;
				} else {
					const isReady = r.status?.conditions?.some(
						(c) => c.type === 'Ready' && c.status === 'True'
					);
					const isFailed = r.status?.conditions?.some(
						(c) => c.type === 'Ready' && c.status === 'False'
					);
					if (isReady) healthy++;
					else if (isFailed) error++;
				}
			});
		});

		return { total, healthy, error, suspended, unknown: total - healthy - error - suspended };
	});

	let s = $derived(stats());
</script>

<div class="flex h-full flex-col justify-between py-1">
	<div class="space-y-3">
		<!-- Progress bar summary -->
		<div class="flex h-2 w-full overflow-hidden rounded-full bg-secondary/30 shadow-inner">
			{#if s.total > 0}
				<div
					class="h-full bg-emerald-500 transition-all duration-500"
					style="width: {(s.healthy / s.total) * 100}%"
				></div>
				<div
					class="h-full bg-red-500 transition-all duration-500"
					style="width: {(s.error / s.total) * 100}%"
				></div>
				<div
					class="h-full bg-amber-500 transition-all duration-500"
					style="width: {(s.suspended / s.total) * 100}%"
				></div>
				<div
					class="h-full bg-slate-400 transition-all duration-500"
					style="width: {(s.unknown / s.total) * 100}%"
				></div>
			{/if}
		</div>

		<div class="grid grid-cols-2 gap-x-4 gap-y-2">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<div class="size-1.5 rounded-full bg-emerald-500"></div>
					<span class="text-[10px] font-bold text-muted-foreground uppercase">Healthy</span>
				</div>
				<span class="text-xs font-black">{s.healthy}</span>
			</div>
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<div class="size-1.5 rounded-full bg-red-500"></div>
					<span class="text-[10px] font-bold text-muted-foreground uppercase">Errors</span>
				</div>
				<span class="text-xs font-black">{s.error}</span>
			</div>
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<div class="size-1.5 rounded-full bg-amber-500"></div>
					<span class="text-[10px] font-bold text-muted-foreground uppercase">Suspended</span>
				</div>
				<span class="text-xs font-black">{s.suspended}</span>
			</div>
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<div class="size-1.5 rounded-full bg-slate-400"></div>
					<span class="text-[10px] font-bold text-muted-foreground uppercase">Unknown</span>
				</div>
				<span class="text-xs font-black">{s.unknown}</span>
			</div>
		</div>
	</div>

	<div class="mt-4 border-t border-border/50 pt-2 text-center">
		<span class="text-[10px] font-bold text-muted-foreground uppercase"
			>Total Monitored Resources: {s.total}</span
		>
	</div>
</div>
