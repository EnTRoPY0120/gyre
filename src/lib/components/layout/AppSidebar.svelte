<script lang="ts">
	import { page } from '$app/stores';
	import { resourceGroups } from '$lib/config/resources';
	import { sidebarOpen } from '$lib/stores/sidebar';
	import { cn } from '$lib/utils';
	import SidebarResourceGroup from './SidebarResourceGroup.svelte';
	import SidebarFooter from './SidebarFooter.svelte';
	import SidebarHeader from './SidebarHeader.svelte';
	import SidebarPrimaryNav from './SidebarPrimaryNav.svelte';
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

		// Close an open sidebar when crossing into the mobile breakpoint.
		if (wasMobile !== isMobile && isMobile && $sidebarOpen) {
			sidebarOpen.set(false);
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
	class={
		cn(
		'fixed inset-y-0 left-0 z-50 flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out lg:relative lg:z-auto',
		isOpen ? 'w-64 translate-x-0 shadow-2xl lg:shadow-none' : 'w-16 translate-x-0',
		isMobile && isOpen ? 'translate-x-0 shadow-2xl' : isMobile && !isOpen ? 'translate-x-[-100%]' : ''
		)
	}
>
	<SidebarHeader
		{isOpen}
		{gyreVersion}
		onToggle={() => sidebarOpen.toggle()}
		onCloseMobile={closeMobile}
	/>

	<!-- Nav -->
	<div
		class={cn(
			'custom-scrollbar flex-1 space-y-2 overflow-y-auto overflow-x-hidden py-6 transition-all duration-300',
			isOpen ? 'px-3' : 'px-2'
		)}
	>
		<SidebarPrimaryNav {isOpen} {currentPath} {canCreate} onCloseMobile={closeMobile} />

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
		<SidebarFooter {isOpen} {currentPath} onCloseMobile={closeMobile} />
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
