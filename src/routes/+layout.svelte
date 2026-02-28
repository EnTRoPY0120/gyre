<script lang="ts">
	import './layout.css';
	import AppSidebar from '$lib/components/layout/AppSidebar.svelte';
	import AppHeader from '$lib/components/layout/AppHeader.svelte';
	import CommandPalette from '$lib/components/CommandPalette.svelte';
	import { eventsStore } from '$lib/stores/events.svelte';
	import { clusterStore } from '$lib/stores/cluster.svelte';
	import { preferences } from '$lib/stores/preferences.svelte';
	import { page } from '$app/stores';
	import { Toaster } from 'svelte-sonner';
	import { onDestroy } from 'svelte';

	interface Props {
		children: import('svelte').Snippet;
		data: {
			health: {
				connected: boolean;
				clusterName?: string;
				availableClusters: string[];
				error?: string;
			};
			fluxVersion: string;
			gyreVersion: string;
			user: {
				username: string;
				role: string;
				email?: string | null;
				preferences?: import('$lib/types/user').UserPreferences | null;
			} | null;
		};
	}

	let { children, data }: Props = $props();

	// Check if current route is the login page
	let isLoginPage = $derived($page.url.pathname.startsWith('/login'));

	// Sync cluster store and preferences with layout data
	$effect(() => {
		if (data.health.error) {
			clusterStore.setError(data.health.error);
		} else if (data.health.availableClusters && data.health.availableClusters.length > 0) {
			clusterStore.setAvailable(data.health.availableClusters);
		} else {
			clusterStore.setError('No available clusters found');
		}

		if (data.health.clusterName) {
			clusterStore.current = data.health.clusterName;
		}
		if (data.user?.preferences?.notifications) {
			preferences.setNotifications(data.user.preferences.notifications);
		} else {
			preferences.setNotifications(undefined);
		}
	});

	// Connect to SSE when cluster is connected
	let prevConnected = false;
	$effect(() => {
		const isConnected = data.health.connected;
		if (isConnected !== prevConnected) {
			if (isConnected) {
				eventsStore.connect();
			} else {
				eventsStore.disconnect();
			}
			prevConnected = isConnected;
		}
	});

	onDestroy(() => {
		eventsStore.disconnect();
	});
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg?v=3" type="image/svg+xml" />
	<link rel="manifest" href="/manifest.json" />
	<title>Gyre - FluxCD WebUI</title>
	<meta
		name="description"
		content="A modern web interface for managing FluxCD resources in your Kubernetes cluster"
	/>
</svelte:head>

<Toaster position="top-right" richColors closeButton />

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
			<AppHeader health={data.health} fluxVersion={data.fluxVersion} user={data.user} />

			<!-- Scrollable Content -->
			<main class="flex-1 overflow-y-auto p-4 md:p-6 dark:bg-gray-900">
				{@render children()}
			</main>
		</div>
	</div>

	<!-- Global Command Palette -->
	<CommandPalette />
{/if}
