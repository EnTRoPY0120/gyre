<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';
	import { formatTimestamp } from '$lib/utils/flux';
	import StatusBadge from './StatusBadge.svelte';

	let {
		resource,
		showNamespace = true,
		selected = false,
		onRowClick,
		onToggleSelection
	}: {
		resource: FluxResource;
		showNamespace?: boolean;
		selected?: boolean;
		onRowClick: (event: MouseEvent) => void;
		onToggleSelection: () => void;
	} = $props();

	function getReadyMessage(): string {
		const ready = resource.status?.conditions?.find((condition) => condition.type === 'Ready');
		return ready?.message || '-';
	}
</script>

<tr
	class="group cursor-pointer transition-colors hover:bg-accent/40 hover:text-accent-foreground"
	onclick={onRowClick}
>
	<td class="px-4 py-4">
		<input
			type="checkbox"
			checked={selected}
			onchange={onToggleSelection}
			onclick={(event) => event.stopPropagation()}
			class="size-4 cursor-pointer rounded border-border bg-background text-primary focus:ring-2 focus:ring-primary focus:ring-offset-0"
			aria-label={`Select ${resource.metadata.name}`}
		/>
	</td>
	<td class="px-6 py-4 whitespace-nowrap transition-all duration-200 group-hover:pl-7">
		<div
			class="font-mono text-[13px] font-medium text-foreground transition-colors group-hover:text-primary"
		>
			{resource.metadata.name}
		</div>
	</td>
	{#if showNamespace}
		<td class="px-6 py-4 whitespace-nowrap">
			<div
				class="inline-flex items-center rounded-md border border-transparent bg-secondary/40 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-all group-hover:border-border/50"
			>
				{resource.metadata.namespace || '-'}
			</div>
		</td>
	{/if}
	<td class="px-6 py-4 whitespace-nowrap">
		<StatusBadge
			conditions={resource.status?.conditions}
			suspended={resource.spec?.suspend as boolean | undefined}
			observedGeneration={resource.status?.observedGeneration}
			generation={resource.metadata?.generation}
			size="sm"
		/>
	</td>
	<td class="px-6 py-4 whitespace-nowrap">
		<div class="font-mono text-xs font-medium text-muted-foreground">
			{formatTimestamp(resource.metadata.creationTimestamp)}
		</div>
	</td>
	<td class="max-w-[300px] px-6 py-4">
		<div class="truncate text-xs text-muted-foreground/80 group-hover:text-muted-foreground">
			{getReadyMessage()}
		</div>
	</td>
</tr>
