<script lang="ts">
	import { page } from '$app/stores';
	import { getResourceInfo } from '$lib/config/resources';
	import ThemeToggle from './ThemeToggle.svelte';
	import NotificationBell from './NotificationBell.svelte';
	import ClusterSwitcher from './ClusterSwitcher.svelte';
	import UserMenu from './UserMenu.svelte';
	import { ChevronRight, Menu, Search } from 'lucide-svelte';
	import { sidebarOpen } from '$lib/stores/sidebar';
	import { commandPaletteOpen } from '$lib/stores/commandPalette';
	import { cn } from '$lib/utils';

	interface Props {
		health?: {
			connected: boolean;
			clusterName?: string;
			availableClusters?: string[];
		};
		fluxVersion?: string;
		user?: {
			username: string;
			role: string;
			email?: string | null;
			isLocal?: boolean;
		} | null;
	}

	let { health = { connected: false }, fluxVersion = 'v2.x.x', user = null }: Props = $props();

	// Build breadcrumbs from current path
	const breadcrumbs = $derived.by(() => {
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
		} else if (parts[0] === 'admin') {
			crumbs.push({ label: 'Administration', href: '/admin' });
			if (parts[1]) {
				const adminLabels: Record<string, string> = {
					users: 'Users',
					clusters: 'Clusters',
					'auth-providers': 'Auth Providers',
					policies: 'Policies'
				};
				crumbs.push({
					label: adminLabels[parts[1]] || parts[1],
					href: `/admin/${parts[1]}`
				});
			}
		} else if (parts[0] === 'inventory') {
			crumbs.push({ label: 'Inventory', href: '/inventory' });
		} else if (parts[0] === 'create') {
			crumbs.push({ label: 'Create Resource', href: '/create' });
			if (parts[1]) {
				crumbs.push({ label: parts[1], href: `/create/${parts[1]}` });
			}
		} else if (parts[0] === 'change-password') {
			crumbs.push({ label: 'Change Password', href: '/change-password' });
		}

		return crumbs;
	});
</script>

<header
	class="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur-xl transition-all duration-300 supports-[backdrop-filter]:bg-background/60"
>
	<div class="flex items-center gap-4">
		<!-- Mobile Hamburger Menu -->
		<button
			type="button"
			class="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-95 lg:hidden"
			onclick={() => sidebarOpen.toggle()}
			aria-label="Toggle Menu"
		>
			<Menu class="size-5" />
		</button>

		<!-- Breadcrumb Navigation -->
		<nav class="flex min-w-0 items-center" aria-label="Breadcrumb">
			<ol class="flex items-center space-x-1 overflow-hidden text-ellipsis sm:space-x-2">
				{#each breadcrumbs as crumb, i (crumb.href)}
					{#if i > 0}
						<li
							class={cn(
								'flex shrink-0 items-center text-muted-foreground/50',
								i < breadcrumbs.length - 1 && 'hidden md:flex'
							)}
						>
							<ChevronRight class="size-3.5" />
						</li>
					{/if}
					<li class={cn(i < breadcrumbs.length - 1 && 'hidden md:block', 'min-w-0')}>
						{#if i === breadcrumbs.length - 1}
							<span
								class="animate-in fade-in slide-in-from-left-2 xs:max-w-[120px] flex items-center gap-2 truncate rounded-md bg-secondary/50 px-2 py-1 text-[10px] font-bold text-foreground shadow-sm ring-1 ring-border duration-300 sm:max-w-[150px] sm:text-xs md:max-w-none"
							>
								{crumb.label}
							</span>
						{:else}
							<!-- eslint-disable-next-line -->
							<a
								href={crumb.href}
								class="max-w-[100px] truncate text-[10px] font-semibold tracking-wide text-muted-foreground uppercase transition-all hover:text-primary hover:underline hover:underline-offset-4 sm:text-xs md:max-w-none"
							>
								{crumb.label}
							</a>
						{/if}
					</li>
				{/each}
			</ol>
		</nav>
	</div>

	<!-- Right Side: Notifications, Theme Toggle, Connection Status & Actions -->
	<div class="flex shrink-0 items-center gap-1 sm:gap-3 md:gap-4">
		<!-- Search Button -->
		<button
			type="button"
			onclick={() => commandPaletteOpen.open()}
			class="flex items-center gap-2 rounded-md border border-border/60 bg-secondary/40 px-2.5 py-1.5 text-xs text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
			aria-label="Search (Ctrl+K)"
		>
			<Search class="size-3.5 shrink-0" />
			<span class="hidden sm:inline">Search</span>
			<kbd class="hidden items-center gap-0.5 rounded border border-border/60 bg-background/60 px-1 py-0.5 font-mono text-[10px] sm:flex">
				Ctrl+K
			</kbd>
		</button>

		<!-- Notification Bell -->
		<NotificationBell />

		<!-- Theme Toggle -->
		<ThemeToggle />

		<div class="mx-0.5 hidden h-4 w-px bg-border md:block"></div>

		<!-- Cluster Selector -->
		<ClusterSwitcher current={health?.clusterName} available={health?.availableClusters} />

		<!-- Flux Version Badge -->
		{#if fluxVersion}
			<div class="hidden lg:block">
				<span
					class="inline-flex items-center rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 font-mono text-[10px] font-bold text-emerald-500"
					title="Flux CD Version"
				>
					Flux {fluxVersion}
				</span>
			</div>
		{/if}
		<!-- User Menu -->
		<UserMenu {user} />
	</div>
</header>
