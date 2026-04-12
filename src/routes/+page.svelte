<script lang="ts">
	import { page } from '$app/stores';
	import { clusterStore } from '$lib/stores/cluster.svelte';
	import AdminOnboardingChecklist from '$lib/components/dashboard/AdminOnboardingChecklist.svelte';
	import DashboardHeader from '$lib/components/dashboard/DashboardHeader.svelte';
	import ClusterConnectivityStatus from '$lib/components/dashboard/ClusterConnectivityStatus.svelte';
	import ResourceGroupTotals from '$lib/components/dashboard/ResourceGroupTotals.svelte';
	import InventoryArchitecture from '$lib/components/dashboard/InventoryArchitecture.svelte';
	import SystemShortcuts from '$lib/components/dashboard/SystemShortcuts.svelte';
	import { ArrowRight, TriangleAlert } from 'lucide-svelte';

	interface Props {
		data: {
			health: {
				connected: boolean;
				clusterName?: string;
				error?: string;
			};
			streamed: {
				groupCounts: Promise<
					Record<
						string,
						{ total: number; healthy: number; failed: number; suspended: number; error: boolean }
					>
				>;
			};
		};
	}

	let { data }: Props = $props();

	// Show loading while cluster contexts are being fetched
	const isLoading = $derived(!clusterStore.loaded);
	const clusterError = $derived(clusterStore.error);
	const isAdmin = $derived($page.data.user?.role === 'admin');
</script>

<div class="animate-in fade-in space-y-6 duration-700 md:space-y-8">
	<!-- Welcome Header -->
	<DashboardHeader {isLoading} />

	{#if clusterError}
		<div
			class="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-destructive"
			role="alert"
			aria-live="assertive"
			aria-atomic="true"
		>
			<div class="flex items-center gap-2 font-semibold">
				<span><TriangleAlert size="20" aria-hidden="true" /></span>
				<p>Failed to load cluster details</p>
			</div>
			<p class="mt-1 text-sm opacity-80">{clusterError}</p>
		</div>
	{/if}

	<!-- Stats Grid -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-4">
		<ClusterConnectivityStatus {isLoading} health={data.health} />
		{#await data.streamed.groupCounts}
			<ResourceGroupTotals isLoading={true} groupCounts={{}} />
		{:then groupCounts}
			<ResourceGroupTotals isLoading={false} {groupCounts} />
		{:catch}
			<ResourceGroupTotals isLoading={false} groupCounts={{}} />
		{/await}
	</div>

	{#if !data.health.connected}
		<div
			class="rounded-[2rem] border border-destructive/20 bg-destructive/5 p-6 text-foreground shadow-sm md:p-8"
		>
			<div class="flex items-start gap-4">
				<div
					class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"
				>
					<TriangleAlert size="22" aria-hidden="true" />
				</div>
				<div class="min-w-0 flex-1">
					<p class="text-[11px] font-black tracking-[0.24em] text-destructive uppercase">
						Degraded Mode
					</p>
					<h2 class="mt-1 text-xl font-bold">Cluster communication failed</h2>
					<p class="mt-2 max-w-3xl text-sm text-muted-foreground">
						Gyre could not complete the current cluster health check. Use the diagnostics and
						settings paths below to verify connectivity and recovery options instead of
						stopping at the offline status.
					</p>
					<p class="mt-3 rounded-xl border border-destructive/15 bg-background/50 px-4 py-3 text-sm text-muted-foreground">
						{data.health.error || clusterError || 'The Kubernetes API is currently unreachable.'}
					</p>
					{#if isAdmin}
						<div class="mt-4 flex flex-wrap gap-3">
							<a
								href="/admin/clusters"
								data-sveltekit-preload-data="hover"
							class="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
						>
							Open cluster diagnostics
							<ArrowRight size="16" aria-hidden="true" />
						</a>
							<a
								href="/admin/settings"
								data-sveltekit-preload-data="hover"
								class="inline-flex items-center gap-2 rounded-xl border border-border bg-background/70 px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
							>
								Review application settings
							</a>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Resource Groups Section -->
	{#await data.streamed.groupCounts}
		<InventoryArchitecture isLoading={true} groupCounts={{}} />
	{:then groupCounts}
		<InventoryArchitecture isLoading={false} {groupCounts} />
	{:catch}
		<InventoryArchitecture isLoading={false} groupCounts={{}} />
	{/await}

	<AdminOnboardingChecklist />

	<!-- System Shortcuts -->
	<SystemShortcuts />
</div>
