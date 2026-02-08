<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { cn } from '$lib/utils';

	let {
		data
	}: {
		data: {
			label: string;
			kind: string;
			status: 'ready' | 'pending' | 'failed' | 'suspended';
		};
	} = $props();

	const statusColor = $derived(
		{
			ready: 'border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400',
			pending: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
			failed: 'border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400',
			suspended: 'border-zinc-500/50 bg-zinc-500/10 text-zinc-700 dark:text-zinc-400'
		}[data.status] || 'border-zinc-500/50 bg-zinc-500/10'
	);

	const statusIcon = $derived(
		{
			ready: 'check-circle',
			pending: 'loader',
			failed: 'x-circle',
			suspended: 'pause-circle'
		}[data.status] || 'help-circle'
	);

	// Map K8s kind to Icon name (lowercase)
	const iconName = $derived(data.kind.toLowerCase());
</script>

<Handle type="target" position={Position.Left} class="!bg-muted-foreground" />

<div
	class={cn(
		'flex w-[250px] items-center gap-3 rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md hover:ring-2 hover:ring-primary/20',
		statusColor
	)}
>
	<div class="rounded-md bg-background/50 p-2 backdrop-blur-sm">
		<Icon name={iconName} size={24} />
	</div>

	<div class="min-w-0 flex-1">
		<div class="truncate text-sm leading-none font-semibold text-foreground" title={data.label}>
			{data.label}
		</div>
		<div class="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
			<span class="font-mono">{data.kind}</span>
		</div>
	</div>

	<div class={cn('flex items-center justify-center rounded-full p-1', statusColor)}>
		<Icon name={statusIcon} size={14} />
	</div>
</div>

<Handle type="source" position={Position.Right} class="!bg-muted-foreground" />
