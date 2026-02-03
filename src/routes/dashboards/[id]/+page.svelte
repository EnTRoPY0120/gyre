<script lang="ts">
	import type { PageData } from './$types';
	import { Button } from '$lib/components/ui/button';
    import { ArrowLeft, Edit, Share2, Plus } from 'lucide-svelte';
    import { dashboardStore } from '$lib/stores/dashboards.svelte';

	let { data }: { data: PageData } = $props();
    let dashboard = $derived(data.dashboard);
</script>

<div class="flex flex-col gap-6">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-border/50 pb-6">
        <div class="flex items-center gap-4">
            <Button variant="ghost" size="icon" href="/dashboards">
                <ArrowLeft class="size-4" />
            </Button>
            <div>
                <h1 class="text-2xl font-bold tracking-tight flex items-center gap-2">
                    {dashboard.name}
                    {#if dashboard.isDefault}
                        <span class="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Default</span>
                    {/if}
                    {#if dashboard.isShared}
                         <span class="rounded bg-secondary/50 px-2 py-0.5 text-xs font-medium text-muted-foreground flex items-center gap-1">
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
            <Button variant="outline" size="sm" class="gap-2">
                <Edit class="size-4" />
                Edit Layout
            </Button>
            <Button size="sm" class="gap-2">
                <Plus class="size-4" />
                Add Widget
            </Button>
        </div>
    </div>

    <!-- Dashboard Content (Widgets) -->
    <div class="min-h-[500px] rounded-xl border-2 border-dashed border-border/30 bg-muted/10 p-8 flex flex-col items-center justify-center text-muted-foreground">
        {#if dashboard.widgets && dashboard.widgets.length > 0}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                {#each dashboard.widgets as widget}
                    <div class="bg-card border border-border rounded-lg p-4 h-64 shadow-sm">
                        <h3 class="font-medium mb-2">{widget.title}</h3>
                        <div class="text-xs text-muted-foreground bg-muted p-2 rounded">
                            Type: {widget.type}<br>
                            Query: {widget.query || 'N/A'}
                        </div>
                        <div class="mt-4 flex items-center justify-center h-32 bg-secondary/20 rounded border border-dashed border-border/50">
                            Widget Content Placeholder
                        </div>
                    </div>
                {/each}
            </div>
        {:else}
            <div class="text-center max-w-md">
                <p class="text-lg font-medium text-foreground mb-2">This dashboard is empty</p>
                <p class="mb-6">Add widgets to visualize your FluxCD resources and metrics.</p>
                <Button>Add First Widget</Button>
            </div>
        {/if}
    </div>
</div>
