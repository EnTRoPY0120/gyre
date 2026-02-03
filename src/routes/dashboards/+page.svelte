<script lang="ts">
	import { dashboardStore } from '$lib/stores/dashboards.svelte';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Plus, LayoutDashboard, MoreVertical, Trash, Edit } from 'lucide-svelte';
	import { fade } from 'svelte/transition';

	onMount(() => {
		dashboardStore.fetchDashboards();
	});

	function handleDelete(id: string) {
		if (confirm('Are you sure you want to delete this dashboard?')) {
			dashboardStore.deleteDashboard(id);
		}
	}
</script>

<div class="flex flex-col gap-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Dashboards</h1>
			<p class="text-muted-foreground">Manage your custom dashboards and views.</p>
		</div>
		<Button href="/dashboards/new" class="gap-2">
			<Plus class="size-4" />
			New Dashboard
		</Button>
	</div>

	<!-- Dashboards Grid -->
	{#if dashboardStore.loading}
		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each Array(3) as _}
				<div class="h-40 animate-pulse rounded-xl bg-card border border-border/50"></div>
			{/each}
		</div>
	{:else if dashboardStore.error}
		<div class="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-500">
			{dashboardStore.error}
		</div>
	{:else if dashboardStore.dashboards.length === 0}
		<div class="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed text-muted-foreground">
			<LayoutDashboard class="mb-4 size-10 opacity-20" />
			<p>No dashboards found</p>
			<Button variant="link" href="/dashboards/new" class="mt-2">Create your first dashboard</Button>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each dashboardStore.dashboards as dashboard (dashboard.id)}
				<div
					transition:fade
					class="group relative flex h-full flex-col justify-between rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-md"
				>
					<div>
						<div class="flex items-start justify-between">
							<a href="/dashboards/{dashboard.id}" class="hover:underline">
								<h3 class="font-semibold text-lg">{dashboard.name}</h3>
							</a>
							{#if dashboard.isDefault}
								<span class="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Default</span>
							{/if}
						</div>
						<p class="mt-2 text-sm text-muted-foreground line-clamp-2">
							{dashboard.description || 'No description provided.'}
						</p>
					</div>

					<div class="mt-4 flex items-center justify-between border-t border-border/50 pt-4">
						<span class="text-xs text-muted-foreground">
							{dashboard.widgets?.length || 0} widgets
						</span>
						
						<div class="flex gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                class="h-8 w-8 text-muted-foreground hover:text-foreground"
                                href="/dashboards/{dashboard.id}/edit"
                            >
                                <Edit class="size-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                class="h-8 w-8 text-muted-foreground hover:text-red-500"
                                onclick={() => handleDelete(dashboard.id)}
                            >
                                <Trash class="size-4" />
                            </Button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
