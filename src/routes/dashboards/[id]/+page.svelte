<script lang="ts">
	import type { PageData } from './$types';
	import { Button } from '$lib/components/ui/button';
	import { ArrowLeft, Share2, Plus, Layout } from 'lucide-svelte';
	import { dashboardStore } from '$lib/stores/dashboards.svelte';
	import { cn } from '$lib/utils';
	import Widget from '$lib/components/dashboard/Widget.svelte';
	import WidgetDialog from '$lib/components/dashboard/WidgetDialog.svelte';
	import { onMount } from 'svelte';
	import { dndzone } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';

	let { data }: { data: PageData } = $props();

	// Find the dashboard in the store or use the server data
	let dashboard = $derived(
		dashboardStore.dashboards.find((d) => d.id === data.dashboard.id) || data.dashboard
	);

	let isAddWidgetOpen = $state(false);
	let editingWidget = $state<any | null>(null);
	let isLayoutMode = $state(false);

	// We need a local copy of widgets for dnd to work smoothly before save
	let items = $state<any[]>([]);

	$effect(() => {
		if (!isLayoutMode) {
			items = dashboard.widgets.map((w) => ({ ...w }));
		}
	});

	function handleDndConsider(e: CustomEvent<any>) {
		items = e.detail.items;
	}

	function handleDndFinalize(e: CustomEvent<any>) {
		items = e.detail.items;
	}

	async function saveLayout() {
		try {
			await dashboardStore.updateDashboard(dashboard.id, {
				widgets: items
			});
			isLayoutMode = false;
		} catch (err) {
			alert('Failed to save layout: ' + (err instanceof Error ? err.message : 'Unknown error'));
		}
	}

	async function handleSaveWidget(widgetData: any) {
		try {
			if (widgetData.id) {
				// Update existing widget
				// We can use the updateDashboard with the modified widgets list
				const updatedWidgets = dashboard.widgets.map((w) =>
					w.id === widgetData.id ? { ...w, ...widgetData } : w
				);
				await dashboardStore.updateDashboard(dashboard.id, {
					widgets: updatedWidgets
				});
			} else {
				// Add new widget
				await dashboardStore.addWidget(dashboard.id, widgetData);
			}
			editingWidget = null;
		} catch (err) {
			alert('Failed to save widget: ' + (err instanceof Error ? err.message : 'Unknown error'));
		}
	}

	async function handleDeleteWidget(widgetId: string) {
		if (!confirm('Are you sure you want to delete this widget?')) return;
		try {
			await dashboardStore.deleteWidget(dashboard.id, widgetId);
		} catch (err) {
			alert('Failed to delete widget: ' + (err instanceof Error ? err.message : 'Unknown error'));
		}
	}

	onMount(() => {
		// Ensure dashboards are in store if we came here directly
		if (dashboardStore.dashboards.length === 0) {
			dashboardStore.fetchDashboards();
		}
	});
</script>

<div class="flex flex-col gap-6">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-border/50 pb-6">
		<div class="flex items-center gap-4">
			<Button variant="ghost" size="icon" href="/dashboards">
				<ArrowLeft class="size-4" />
			</Button>
			<div>
				<h1 class="flex items-center gap-2 text-2xl font-bold tracking-tight">
					{dashboard.name}
					{#if dashboard.isDefault}
						<span class="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
							>Default</span
						>
					{/if}
					{#if dashboard.isShared}
						<span
							class="flex items-center gap-1 rounded bg-secondary/50 px-2 py-0.5 text-xs font-medium text-muted-foreground"
						>
							<Share2 class="size-3" /> Shared
						</span>
					{/if}
				</h1>
				{#if dashboard.description}
					<p class="text-muted-foreground">{dashboard.description}</p>
				{/if}
			</div>
		</div>

		<div class="flex items-center gap-2">
			{#if isLayoutMode}
				<Button variant="outline" size="sm" onclick={() => (isLayoutMode = false)}>Cancel</Button>
				<Button size="sm" class="gap-2" onclick={saveLayout}>Save Layout</Button>
			{:else}
				<Button variant="outline" size="sm" class="gap-2" onclick={() => (isLayoutMode = true)}>
					<Layout class="size-4" />
					Edit Layout
				</Button>
				<Button size="sm" class="gap-2" onclick={() => (isAddWidgetOpen = true)}>
					<Plus class="size-4" />
					Add Widget
				</Button>
			{/if}
		</div>
	</div>

	<!-- Widget Dialog (Add/Edit) -->
	<WidgetDialog
		isOpen={isAddWidgetOpen || !!editingWidget}
		onClose={() => {
			isAddWidgetOpen = false;
			editingWidget = null;
		}}
		onSave={handleSaveWidget}
		widget={editingWidget}
	/>

	<!-- Dashboard Content (Widgets) -->
	<div
		class={cn(
			'min-h-[500px] rounded-xl transition-all duration-300',
			isLayoutMode
				? 'border-2 border-dashed border-primary/30 bg-primary/5 p-4'
				: 'border border-border/10 bg-muted/5 p-0'
		)}
	>
		{#if items && items.length > 0}
			<div
				class="grid w-full auto-rows-min grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
				use:dndzone={{ items, flipDurationMs: 200, dragDisabled: !isLayoutMode }}
				onconsider={handleDndConsider}
				onfinalize={handleDndFinalize}
			>
				{#each items as widget (widget.id)}
					<div animate:flip={{ duration: 200 }} class="h-full">
						<Widget
							{widget}
							onDelete={handleDeleteWidget}
							onEdit={(id) => {
								editingWidget = dashboard.widgets.find((w) => w.id === id);
							}}
						/>
					</div>
				{/each}
			</div>
		{:else}
			<div class="max-w-md text-center">
				<p class="mb-2 text-lg font-medium text-foreground">This dashboard is empty</p>
				<p class="mb-6">Add widgets to visualize your FluxCD resources and metrics.</p>
				<Button onclick={() => (isAddWidgetOpen = true)}>Add First Widget</Button>
			</div>
		{/if}
	</div>
</div>
