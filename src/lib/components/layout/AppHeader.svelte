<script lang="ts">
	import { page } from '$app/stores';
	import { getResourceInfo } from '$lib/config/resources';
	import ThemeToggle from './ThemeToggle.svelte';
	import NotificationBell from './NotificationBell.svelte';
	import { ChevronRight, Settings } from 'lucide-svelte';

	interface Props {
		health?: {
			connected: boolean;
			clusterName?: string;
		};
	}

	let { health = { connected: false } }: Props = $props();

	// Build breadcrumbs from current path
	const breadcrumbs = $derived(() => {
		const pathname = $page.url.pathname;
		const parts = pathname.split('/').filter(Boolean);
		const crumbs: { label: string; href: string }[] = [];

		if (parts.length === 0) {
			return [{ label: 'Dashboard', href: '/' }];
		}

		crumbs.push({ label: 'Dashboard', href: '/' });

		if (parts[0] === 'resources' && parts[1]) {
			const resourceInfo = getResourceInfo(parts[1]);
			const displayName = resourceInfo?.displayName || parts[1];
			crumbs.push({ label: displayName, href: `/resources/${parts[1]}` });

			if (parts[2] && parts[3]) {
				// Detail page: /resources/[type]/[namespace]/[name]
				const name = parts[3];
				crumbs.push({
					label: `${parts[2]}/${name}`,
					href: `/resources/${parts[1]}/${parts[2]}/${parts[3]}`
				});
			}
		}

		return crumbs;
	});
</script>

<header class="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 md:px-6 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60">
	<!-- Breadcrumb Navigation -->
	<nav class="flex items-center" aria-label="Breadcrumb">
		<ol class="flex items-center space-x-2">
			{#each breadcrumbs() as crumb, i}
				{#if i > 0}
					<li class="flex items-center text-muted-foreground">
						<ChevronRight class="size-4" />
					</li>
				{/if}
				<li>
					{#if i === breadcrumbs().length - 1}
						<span class="text-xs md:text-sm font-medium text-foreground truncate max-w-[100px] md:max-w-none">{crumb.label}</span>
					{:else}
						<a
							href={crumb.href}
							class="text-xs md:text-sm text-muted-foreground transition-colors hover:text-foreground truncate max-w-[80px] md:max-w-none"
						>
							{crumb.label}
						</a>
					{/if}
				</li>
			{/each}
		</ol>
	</nav>

	<!-- Right Side: Notifications, Theme Toggle, Connection Status & Actions -->
	<div class="flex items-center gap-4">
		<!-- Notification Bell (Hidden on small mobile) -->
		<div class="hidden sm:block">
			<NotificationBell />
		</div>

		<!-- Theme Toggle -->
		<ThemeToggle />

		<!-- Cluster Connection Status (Hidden on mobile) -->
		<div class="hidden sm:flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1.5">
			{#if health.connected}
				<span class="relative flex h-2 w-2">
					<span
						class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"
					></span>
					<span class="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
				</span>
				<span class="text-xs font-medium text-foreground">
					{health.clusterName || 'Connected'}
				</span>
			{:else}
				<span class="relative flex h-2 w-2">
					<span class="relative inline-flex h-2 w-2 rounded-full bg-destructive"></span>
				</span>
				<span class="text-xs font-medium text-muted-foreground">Disconnected</span>
			{/if}
		</div>

		<!-- Settings Button (Hidden on mobile) -->
		<button
			type="button"
			class="hidden md:rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
			aria-label="Settings"
		>
			<Settings class="size-5" />
		</button>
	</div>
</header>
