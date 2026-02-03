<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import AppSidebar from '$lib/components/layout/AppSidebar.svelte';
	import AppHeader from '$lib/components/layout/AppHeader.svelte';
	import { websocketStore } from '$lib/stores/websocket.svelte';
	import { clusterStore } from '$lib/stores/cluster.svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	interface Props {
		children: import('svelte').Snippet;
		data: {
			health: {
				connected: boolean;
				clusterName?: string;
				availableClusters: string[];
			};
		};
	}

	let { children, data }: Props = $props();

	// Check if current route is the login page
	let isLoginPage = $derived($page.url.pathname.startsWith('/login'));

	// Sync cluster store with layout data
	$effect(() => {
		if (data.health.availableClusters) {
			clusterStore.setAvailable(data.health.availableClusters);
		}
		if (data.health.clusterName) {
			clusterStore.current = data.health.clusterName;
		}
	});

	// Connect to SSE on mount
	onMount(() => {
		if (data.health.connected) {
			websocketStore.connect();
		}

		return () => {
			websocketStore.disconnect();
		};
	});
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg?v=3" type="image/svg+xml" />
	<title>Gyre - FluxCD WebUI</title>
	<meta
		name="description"
		content="A modern web interface for managing FluxCD resources in your Kubernetes cluster"
	/>
</svelte:head>

{#if isLoginPage}
	<!-- Login page: no sidebar/header -->
	{@render children()}
{:else}
	<!-- Normal app layout with sidebar and header -->
	<div class="flex h-screen bg-gray-50 dark:bg-gray-950">
		<!-- Sidebar -->
		<AppSidebar />

		<!-- Main Content Area -->
		<div class="flex flex-1 flex-col overflow-hidden">
			<!-- Header -->
			<AppHeader health={data.health} />

			<!-- Scrollable Content -->
			<main class="flex-1 overflow-y-auto p-6 dark:bg-gray-900">
				{@render children()}
			</main>
		</div>
	</div>
{/if}
