<script lang="ts">
	import { page } from '$app/stores';
	import { resourceGroups } from '$lib/config/resources';
	import { sidebarOpen } from '$lib/stores/sidebar';
	import { cn } from '$lib/utils';
	import Icon from '$lib/components/ui/Icon.svelte';
	import SidebarResourceGroup from './SidebarResourceGroup.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { fade } from 'svelte/transition';

	import { onMount, onDestroy } from 'svelte';

	const isOpen = $derived($sidebarOpen);
	const currentPath = $derived($page.url.pathname);

	const gyreVersion = $derived($page.data.gyreVersion || '0.0.1');
	const userRole = $derived($page.data.user?.role || 'viewer');
	const canCreate = $derived(userRole === 'admin' || userRole === 'editor');
	const isAdmin = $derived(userRole === 'admin');

	// Responsiveness
	let isMobile = $state(false);

	function updateMobileState() {
		const wasMobile = isMobile;
		isMobile = window.innerWidth < 1024;

		// If we just crossed the breakpoint
		if (wasMobile !== isMobile) {
			if (isMobile && $sidebarOpen) {
				sidebarOpen.set(false);
			} else if (!isMobile && !$sidebarOpen) {
				// We don't necessarily want to force it open on desktop,
				// but many apps do. Let's keep it as is for now.
			}
		}
	}

	onMount(() => {
		updateMobileState();
		window.addEventListener('resize', updateMobileState);
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('resize', updateMobileState);
		}
	});

	// Tracking which groups are expanded (all collapsed by default)
	let expandedGroups = $state<Record<string, boolean>>(
		Object.fromEntries(resourceGroups.map((g) => [g.name, false])) as Record<string, boolean>
	);

	function toggleGroup(name: string) {
		if (!isOpen) {
			sidebarOpen.set(true);
			expandedGroups[name] = true;
			return;
		}
		expandedGroups[name] = !expandedGroups[name];
	}

	function closeMobile() {
		if (isMobile) {
			sidebarOpen.set(false);
		}
	}

</script>

<!-- Mobile Backdrop -->
{#if isMobile && isOpen}
	<!-- eslint-disable-next-line -->
	<div
		transition:fade={{ duration: 200 }}
		class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
		onclick={() => sidebarOpen.set(false)}
		onkeydown={(e) => e.key === 'Escape' && sidebarOpen.set(false)}
		role="button"
		tabindex="0"
		aria-label="Close sidebar"
	></div>
{/if}

<aside
	class={cn(
		'fixed inset-y-0 left-0 z-50 flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out lg:relative lg:z-auto',
		isOpen ? 'w-64 translate-x-0 shadow-2xl lg:shadow-none' : 'w-16 translate-x-0',
		isMobile && isOpen ? 'translate-x-0 shadow-2xl' : isMobile && !isOpen ? 'translate-x-[-100%]' : ''
	)}
>
	<!-- Header -->
	<div
		class={cn(
			'flex h-20 shrink-0 flex-col justify-center border-b border-sidebar-border transition-all duration-300',
			isOpen ? 'px-4' : 'px-0'
		)}
	>
		<div
			class={cn('flex items-center overflow-hidden', isOpen ? 'justify-between' : 'justify-center')}
		>
			{#if isOpen}
				<!-- Logo & Brand (Only visible when open) -->
				<a
					href="/"
					class="group flex items-center gap-3 overflow-hidden"
					onclick={closeMobile}
					data-sveltekit-preload-data="hover"
				>
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/20 transition-all group-hover:scale-105 group-hover:shadow-amber-500/30"
					>
						<svg class="h-6 w-6 text-slate-900" viewBox="0 0 24 24" fill="currentColor">
							<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
						</svg>
					</div>
					<div class="flex flex-col transition-all duration-300">
						<div class="flex items-start gap-1 whitespace-nowrap">
							<span
								class="text-xl leading-tight font-bold tracking-tight text-foreground"
								>Gyre</span
							>
							<span
								class="inline-flex items-center rounded-md border border-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-500/50"
							>
								alpha
							</span>
						</div>
						<span
							class="mt-0.5 inline-flex w-fit items-center rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-primary whitespace-nowrap"
						>
							v{gyreVersion}
						</span>
					</div>
				</a>

				<!-- Collapse Button (Chevron) -->
				<button
					onclick={() => sidebarOpen.toggle()}
					class="rounded-lg p-2 text-muted-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:scale-95"
					aria-label="Collapse Sidebar"
				>
					<Icon name="chevron-left" size={20} />
				</button>
			{:else}
				<!-- Expand Button (Hamburger) - Replaces logo when collapsed -->
				<button
					onclick={() => sidebarOpen.toggle()}
					class="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-sidebar-accent hover:text-primary active:scale-95"
					aria-label="Expand Sidebar"
				>
					<Icon name="menu" size={24} />
				</button>
			{/if}
		</div>
	</div>

	<!-- Nav -->
	<div
		class={cn(
			'custom-scrollbar flex-1 space-y-2 overflow-y-auto overflow-x-hidden py-6 transition-all duration-300',
			isOpen ? 'px-3' : 'px-2'
		)}
	>
		<!-- Dashboard -->
		<a
			href="/"
			onclick={closeMobile}
			data-sveltekit-preload-data="hover"
			class={cn(
				'group flex items-center rounded-xl font-bold transition-all duration-300',
				isOpen ? 'gap-3 px-4 py-3 text-sm' : 'justify-center p-2.5',
				currentPath === '/'
					? 'bg-primary text-primary-foreground shadow-[0_4px_20px_-4px_rgba(234,179,8,0.3)]'
					: 'text-muted-foreground hover:bg-muted hover:text-foreground'
			)}
			aria-label={!isOpen ? 'Dashboard' : undefined}
		>
			<Icon
				name="dashboard"
				size={isOpen ? 18 : 22}
				class={cn(
					'shrink-0 transition-transform group-hover:scale-110',
					currentPath === '/' && 'animate-pulse'
				)}
			/>
			<span
				class={cn(
					'transition-all duration-300 overflow-hidden whitespace-nowrap',
					isOpen ? 'opacity-100' : 'pointer-events-none w-0 opacity-0'
				)}
			>
				Dashboard
			</span>
		</a>

		<div class="mx-2 my-2 h-px bg-sidebar-border/50"></div>

		<!-- Create Resource -->
		{#if !canCreate}
			<Tooltip.Provider delayDuration={200}>
				<Tooltip.Root>
					<Tooltip.Trigger class="w-full">
						{#snippet child({ props })}
							<span {...props}>
								<button
									type="button"
									aria-disabled="true"
									class={cn(
										'group flex w-full cursor-not-allowed items-center rounded-xl text-muted-foreground opacity-60 transition-all duration-300',
										isOpen ? 'gap-3 px-4 py-3 text-sm font-bold' : 'justify-center p-2.5'
									)}
								>
									<div
										class={cn(
											'flex shrink-0 items-center justify-center rounded-md bg-primary/10 transition-colors',
											isOpen ? 'size-5' : 'size-7'
										)}
									>
										<Icon name="plus" size={isOpen ? 14 : 20} />
									</div>
									<span
										class={cn(
											'transition-all duration-300 overflow-hidden whitespace-nowrap',
											isOpen ? 'opacity-100' : 'pointer-events-none w-0 opacity-0'
										)}
									>
										Create Resource
									</span>
								</button>
							</span>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="right">
						<p class="text-xs text-white">You need additional permissions to create resources.</p>
					</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
		{:else}
			<a
				href="/create"
				onclick={closeMobile}
				data-sveltekit-preload-data="hover"
				class={cn(
					'group flex items-center rounded-xl font-bold transition-all duration-300',
					isOpen ? 'gap-3 px-4 py-3 text-sm' : 'justify-center p-2.5',
					currentPath.startsWith('/create')
						? 'bg-primary text-primary-foreground shadow-[0_4px_20px_-4px_rgba(234,179,8,0.4)]'
						: 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
				)}
				aria-label={!isOpen ? 'Create Resource' : undefined}
			>
				<div
					class={cn(
						'flex shrink-0 items-center justify-center rounded-md bg-primary/10 transition-colors group-hover:bg-primary group-hover:text-primary-foreground',
						isOpen ? 'size-5' : 'size-7'
					)}
				>
					<Icon name="plus" size={isOpen ? 14 : 20} />
				</div>
				<span
					class={cn(
						'transition-all duration-300 overflow-hidden whitespace-nowrap',
						isOpen ? 'opacity-100' : 'pointer-events-none w-0 opacity-0'
					)}
				>
					Create Resource
				</span>
			</a>
		{/if}

		<div class="mx-2 my-2 h-px bg-sidebar-border/50"></div>

		<!-- Groups -->
		<div
			class={cn(
				'space-y-1 transition-all duration-300',
				!isOpen && 'flex flex-col items-center gap-1'
			)}
			>
				{#each resourceGroups as group (group.name)}
					<SidebarResourceGroup
						{group}
						{isOpen}
						expanded={expandedGroups[group.name]}
						onToggle={() => toggleGroup(group.name)}
						onCloseMobile={closeMobile}
					/>
				{/each}
		</div>
	</div>

	<!-- Footer (Pinned) -->
	{#if isAdmin}
		<div
			class={cn(
				'mt-auto border-t border-sidebar-border/20 py-4 transition-all duration-300',
				isOpen ? 'px-3' : 'px-2'
			)}
		>
			<a
				href="/admin"
				onclick={closeMobile}
				data-sveltekit-preload-data="hover"
				class={cn(
					'group flex items-center rounded-xl font-bold transition-all duration-300',
					isOpen ? 'gap-3 px-4 py-3 text-sm' : 'mx-auto justify-center p-2.5',
					currentPath.startsWith('/admin')
						? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_4px_20px_-4px_rgba(234,179,8,0.2)]'
						: 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
				)}
				aria-label={!isOpen ? 'Admin' : undefined}
			>
				<Icon
					name="settings"
					size={isOpen ? 18 : 22}
					class={cn(
						'shrink-0 transition-transform group-hover:scale-110',
						currentPath.startsWith('/admin') && 'animate-pulse'
					)}
				/>
				<span
					class={cn(
						'transition-all duration-300 overflow-hidden whitespace-nowrap',
						isOpen ? 'opacity-100' : 'pointer-events-none w-0 opacity-0'
					)}
				>
					Admin
				</span>
			</a>
		</div>
	{/if}
</aside>

<style>
	/* Subtle and premium custom scrollbar */
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.05);
		border-radius: 20px;
	}
	.custom-scrollbar:hover::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.1);
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: var(--sidebar-primary);
	}
</style>
