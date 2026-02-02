<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import AppSidebar from '$lib/components/layout/AppSidebar.svelte';
	import AppHeader from '$lib/components/layout/AppHeader.svelte';

	interface Props {
		children: import('svelte').Snippet;
		data: {
			health: {
				connected: boolean;
				clusterName?: string;
			};
		};
	}

	let { children, data }: Props = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Gyre - FluxCD WebUI</title>
	<meta name="description" content="A modern web interface for managing FluxCD resources in your Kubernetes cluster" />
</svelte:head>

<div class="flex h-screen bg-gray-50">
	<!-- Sidebar -->
	<AppSidebar />

	<!-- Main Content Area -->
	<div class="flex flex-1 flex-col overflow-hidden">
		<!-- Header -->
		<AppHeader health={data.health} />

		<!-- Scrollable Content -->
		<main class="flex-1 overflow-y-auto p-6">
			{@render children()}
		</main>
	</div>
</div>
