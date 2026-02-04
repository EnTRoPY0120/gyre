<script lang="ts">
	import type { DashboardWidget } from '$lib/stores/dashboards.svelte';
	import { cn } from '$lib/utils';
	import { Settings, Trash2 } from 'lucide-svelte';
	import ResourceCountWidget from './widgets/ResourceCountWidget.svelte';
	import ResourceListWidget from './widgets/ResourceListWidget.svelte';
	import StatusSummaryWidget from './widgets/StatusSummaryWidget.svelte';
	import EventsWidget from './widgets/EventsWidget.svelte';
	import MarkdownWidget from './widgets/MarkdownWidget.svelte';

	let {
		widget,
		onDelete,
		onEdit
	}: {
		widget: DashboardWidget;
		onDelete?: (id: string) => void;
		onEdit?: (id: string) => void;
	} = $props();

	let config = $derived(widget.config ? JSON.parse(widget.config) : {});
	let position = $derived(widget.position ? JSON.parse(widget.position) : { w: 1, h: 1 });

	async function handleDelete() {
		if (confirm(`Are you sure you want to delete the widget "${widget.title}"?`)) {
			onDelete?.(widget.id);
		}
	}
</script>

<div
	class={cn(
		'group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:shadow-md',
		position.w === 2 && 'md:col-span-2',
		position.w === 3 && 'lg:col-span-3'
	)}
	style="min-height: {position.h * 150}px;"
>
	<!-- Widget Header -->
	<div class="flex items-center justify-between border-b border-border/50 bg-muted/20 px-4 py-2">
		<h3 class="truncate text-xs font-bold tracking-wide text-muted-foreground uppercase">
			{widget.title}
		</h3>

		<div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
			<button
				onclick={() => onEdit?.(widget.id)}
				class="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
				title="Widget Settings"
			>
				<Settings class="size-3.5" />
			</button>
			<button
				onclick={handleDelete}
				class="rounded-md p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
				title="Delete Widget"
			>
				<Trash2 class="size-3.5" />
			</button>
		</div>
	</div>

	<!-- Widget Content -->
	<div class="flex-1 overflow-auto p-4">
		{#if widget.type === 'resource-count'}
			<ResourceCountWidget {widget} {config} />
		{:else if widget.type === 'resource-list'}
			<ResourceListWidget {widget} {config} />
		{:else if widget.type === 'status-summary'}
			<StatusSummaryWidget {widget} {config} />
		{:else if widget.type === 'recent-events'}
			<EventsWidget {widget} {config} />
		{:else if widget.type === 'markdown'}
			<MarkdownWidget {widget} {config} />
		{:else}
			<div class="flex h-full items-center justify-center text-sm text-muted-foreground italic">
				Unknown widget type: {widget.type}
			</div>
		{/if}
	</div>
</div>
