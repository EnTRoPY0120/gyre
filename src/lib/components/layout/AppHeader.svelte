<script lang="ts">
	import { page } from '$app/stores';
	import { getResourceInfo } from '$lib/config/resources';
	import ThemeToggle from './ThemeToggle.svelte';
	import NotificationBell from './NotificationBell.svelte';
	import ClusterSwitcher from './ClusterSwitcher.svelte';
	import UserMenu from './UserMenu.svelte';
	import { ChevronRight, Settings } from 'lucide-svelte';

	interface Props {
		health?: {
			connected: boolean;
			clusterName?: string;
			availableClusters?: string[];
		};
		user?: {
			username: string;
			role: string;
			email?: string | null;
		} | null;
	}

	let { health = { connected: false }, user = null }: Props = $props();

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

<header
	class="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur-xl transition-all duration-300 supports-[backdrop-filter]:bg-background/60"
>
	<!-- Breadcrumb Navigation -->
	<nav class="flex items-center" aria-label="Breadcrumb">
		<ol class="flex items-center space-x-2">
			{#each breadcrumbs() as crumb, i}
				{#if i > 0}
					<li class="flex items-center text-muted-foreground/50">
						<ChevronRight class="size-3.5" />
					</li>
				{/if}
				<li>
					{#if i === breadcrumbs().length - 1}
						<span
							class="animate-in fade-in slide-in-from-left-2 flex max-w-[150px] items-center gap-2 truncate rounded-md bg-secondary/50 px-2 py-1 text-xs font-bold text-foreground shadow-sm ring-1 ring-border duration-300 md:max-w-none"
						>
							{crumb.label}
						</span>
					{:else}
						<a
							href={crumb.href}
							class="max-w-[100px] truncate text-xs font-semibold tracking-wide text-muted-foreground uppercase transition-all hover:text-primary hover:underline hover:underline-offset-4 md:max-w-none"
						>
							{crumb.label}
						</a>
					{/if}
				</li>
			{/each}
		</ol>
	</nav>

	<!-- Right Side: Notifications, Theme Toggle, Connection Status & Actions -->
	<div class="flex items-center gap-3 md:gap-4">
		<!-- Notification Bell (Hidden on small mobile) -->
		<div class="hidden sm:block">
			<NotificationBell />
		</div>

		<!-- Theme Toggle -->
		<ThemeToggle />

		<div class="mx-1 hidden h-4 w-px bg-border sm:block"></div>

		<!-- Cluster Selector (Hidden on mobile) -->
		<div class="hidden sm:block">
			<ClusterSwitcher current={health?.clusterName} available={health?.availableClusters} />
		</div>

		<!-- User Menu -->
		<UserMenu {user} />

		<!-- Settings Button (Hidden on mobile) -->
		<button
			type="button"
			class="hidden h-9 w-9 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-all hover:border-border hover:bg-accent hover:text-foreground active:scale-95 md:flex"
			aria-label="Settings"
		>
			<Settings class="size-4.5" />
		</button>
	</div>
</header>
