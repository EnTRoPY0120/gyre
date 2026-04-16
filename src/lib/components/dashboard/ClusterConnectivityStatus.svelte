<script lang="ts">
	import { page } from '$app/stores';
	import Icon from '$lib/components/ui/Icon.svelte';

	interface Props {
		isLoading: boolean;
		health: {
			connected: boolean;
			currentClusterName: string;
			error?: string;
		};
	}

	let { isLoading, health }: Props = $props();
	const isAdmin = $derived($page.data.user?.role === 'admin');
</script>

<!-- Connection Card -->
<div
	class="overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition-all hover:bg-card/90 hover:shadow-md md:col-span-2 lg:col-span-1"
>
	<div class="p-6">
		<div class="mb-4 flex items-center justify-between">
			<p class="text-[10px] font-black tracking-[0.2em] text-muted-foreground uppercase">
				Connectivity
			</p>
			<Icon name="monitor" size={16} class="text-muted-foreground/30" />
		</div>
		<div class="flex items-center gap-5">
			{#if isLoading}
				<div
					class="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-muted/50"
				>
					<Icon name="loader" size={28} class="animate-spin text-muted-foreground/50" />
				</div>
				<div>
					<p class="font-display text-xl leading-none font-extrabold text-foreground">Loading...</p>
					<p class="mt-1.5 font-mono text-[11px] text-muted-foreground">
						Initializing cluster connection
					</p>
				</div>
			{:else if health.connected}
				<div
					class="flex h-14 w-14 items-center justify-center rounded-2xl border border-green-500/20 bg-green-500/10 text-green-500"
				>
					<Icon name="check" size={28} />
				</div>
				<div class="min-w-0">
					<p class="font-display text-xl leading-none font-extrabold text-foreground">Active</p>
					<p class="mt-1.5 font-mono text-[11px] font-bold break-all text-muted-foreground">
						{health.currentClusterName}
					</p>
				</div>
			{:else}
				<div
					class="flex h-14 w-14 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive"
				>
					<Icon name="x" size={28} />
				</div>
				<div class="min-w-0 flex-1">
					<p class="font-display text-xl leading-none font-extrabold text-foreground">Down</p>
					<p class="mt-1.5 font-mono text-[11px] font-bold text-destructive uppercase">
						Offline
					</p>
					<p class="mt-2 text-sm text-muted-foreground">
						{health.error || 'Gyre could not communicate with the Kubernetes API.'}
					</p>
					{#if isAdmin}
						<div class="mt-3 flex flex-wrap gap-2">
							<a
								href="/admin/clusters"
								data-sveltekit-preload-data="hover"
								class="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
							>
								Open Clusters
								<Icon name="arrow-right" size={14} />
							</a>
							<a
								href="/admin/settings"
								data-sveltekit-preload-data="hover"
								class="inline-flex items-center gap-2 rounded-lg border border-border bg-background/70 px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
							>
								Review Settings
							</a>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
