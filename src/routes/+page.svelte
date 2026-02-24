<script lang="ts">
	import { clusterStore } from '$lib/stores/cluster.svelte';
	import DashboardHeader from '$lib/components/dashboard/DashboardHeader.svelte';
	import ClusterConnectivityStatus from '$lib/components/dashboard/ClusterConnectivityStatus.svelte';
	import ResourceGroupTotals from '$lib/components/dashboard/ResourceGroupTotals.svelte';
	import InventoryArchitecture from '$lib/components/dashboard/InventoryArchitecture.svelte';
	import SystemShortcuts from '$lib/components/dashboard/SystemShortcuts.svelte';
	import { AlertTriangle } from 'lucide-svelte';

	interface Props {
		data: {
			health: {
				connected: boolean;
				clusterName?: string;
			};
			groupCounts: Record<
				string,
				{ total: number; healthy: number; failed: number; error: boolean }
			>;
		};
	}

	let { data }: Props = $props();

	// Show loading while cluster contexts are being fetched
	const isLoading = $derived(!clusterStore.loaded);
	const clusterError = $derived(clusterStore.error);
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
				<span class="text-lg"><AlertTriangle size="20" aria-hidden="true" /></span>
				<p>Failed to load cluster details</p>
			</div>
			<p class="mt-1 text-sm opacity-80">{clusterError}</p>
		</div>
	{/if}

	<!-- Stats Grid -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-4">
		<ClusterConnectivityStatus {isLoading} health={data.health} />
		<ResourceGroupTotals {isLoading} groupCounts={data.groupCounts} />
	</div>

	<!-- Resource Groups Section -->
	<InventoryArchitecture {isLoading} groupCounts={data.groupCounts} />

	<!-- System Shortcuts -->
	<SystemShortcuts />
</div>
