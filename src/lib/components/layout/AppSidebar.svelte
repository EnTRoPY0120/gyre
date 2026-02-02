<script lang="ts">
	import { page } from '$app/stores';
	import { resourceGroups } from '$lib/config/resources';
	import { sidebarOpen } from '$lib/stores/sidebar';
	import { cn } from '$lib/utils';
	import { FluxResourceType } from '$lib/types/flux';
	import Icon from '$lib/components/ui/Icon.svelte';

	import { onMount, onDestroy } from 'svelte';
	const isOpen = $derived($sidebarOpen);
	const currentPath = $derived($page.url.pathname);

	const fluxVersion = $derived($page.data.fluxVersion || 'v2.x.x');

	// Responsiveness
	let isMobile = $state(false);

	function updateMobileState() {
		isMobile = window.innerWidth < 1024;
		if (isMobile && $sidebarOpen) {
			sidebarOpen.set(false);
		} else if (!isMobile && !$sidebarOpen) {
			sidebarOpen.set(true);
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

	// Tracking which groups are expanded
	let expandedGroups = $state<Record<string, boolean>>({
		'Sources': true,
		'Kustomize': true,
		'Helm': true,
		'Notifications': true,
		'Image Automation': true
	});

	function toggleGroup(name: string) {
		expandedGroups[name] = !expandedGroups[name];
	}

	const GroupIcons: Record<string, string> = {
		'Sources': 'sideways-git',
		'Kustomize': 'kustomize',
		'Helm': 'helm',
		'Notifications': 'bell',
		'Image Automation': 'layers'
	};

	const ResourceIcons: Record<string, string> = {
		[FluxResourceType.GitRepository]: 'git-branch',
		[FluxResourceType.HelmRepository]: 'library',
		[FluxResourceType.HelmChart]: 'package',
		[FluxResourceType.Bucket]: 'bucket',
		[FluxResourceType.OCIRepository]: 'cloud',
		[FluxResourceType.Kustomization]: 'file-cog',
		[FluxResourceType.HelmRelease]: 'ship',
		[FluxResourceType.Alert]: 'shield-alert',
		[FluxResourceType.Provider]: 'radio',
		[FluxResourceType.Receiver]: 'activity',
		[FluxResourceType.ImageRepository]: 'cloud',
		[FluxResourceType.ImagePolicy]: 'shield-alert',
		[FluxResourceType.ImageUpdateAutomation]: 'refresh-cw'
	};

	function isActive(type: string): boolean {
		return currentPath.includes(`/resources/${type}`);
	}
</script>

{#if isOpen}
	<aside class="flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out">
		<!-- Header -->
		<div class="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
			<a href="/" class="flex items-center gap-2 text-lg font-bold tracking-tight font-display">
				<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
					<Icon name="dashboard" size={18} />
				</div>
				<span class="bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">Gyre</span>
			</a>
			<button 
				onclick={() => sidebarOpen.toggle()}
				class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
				title="Collapse Sidebar"
			>
				<Icon name="chevron-right" size={18} class="rotate-180" />
			</button>
		</div>

		<!-- Nav -->
		<div class="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-hide">
			<!-- Dashboard -->
			<a href="/" class={cn(
				"flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200",
				currentPath === '/' 
					? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-border" 
					: "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
			)}>
				<Icon name="dashboard" size={16} />
				Dashboard
			</a>

			<!-- Groups -->
			{#each resourceGroups as group}
				<div class="mt-4 space-y-1">
					<button 
						onclick={() => toggleGroup(group.name)}
						class="group flex w-full items-center justify-between px-2 py-1.5 text-xs font-black uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground font-display transition-colors"
					>
                        <div class="flex items-center gap-2">
                            {#if GroupIcons[group.name]}
                                 <Icon name={GroupIcons[group.name]} size={12} class="transition-transform group-hover:scale-110" />
                            {/if}
						    {group.name}
                        </div>
                        <Icon 
							name="chevron-right" 
							size={12} 
							class={cn("transition-transform duration-200", expandedGroups[group.name] ? "rotate-90" : "rotate-0")} 
						/>
					</button>
					
					{#if expandedGroups[group.name]}
						<div class="space-y-0.5 ml-1 border-l border-sidebar-border/50 pl-2">
							{#each group.resources as resource}
								{@const iconName = ResourceIcons[resource.type] || 'file-cog'}
								<a href="/resources/{resource.type}" class={cn(
									"flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-all duration-200",
									isActive(resource.type) 
										? "bg-sidebar-accent/80 text-sidebar-accent-foreground font-medium shadow-sm ring-1 ring-border" 
										: "text-muted-foreground hover:bg-sidebar-accent/30 hover:text-sidebar-accent-foreground"
								)}>
									<Icon name={iconName} size={14} />
									<span>{resource.displayName}</span>
								</a>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Footer -->
		<div class="border-t border-sidebar-border p-4 bg-muted/10">
			<div class="flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-3 backdrop-blur-sm">
				<div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-black text-primary border border-primary/20">
					VP
				</div>
				<div class="flex-1 overflow-hidden">
					<p class="truncate text-sm font-semibold tracking-tight">Flux Cluster</p>
					<div class="flex items-center gap-1">
						<div class="size-1.5 rounded-full bg-green-500 animate-pulse"></div>
						<p class="truncate text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{fluxVersion}</p>
					</div>
				</div>
			</div>
		</div>
	</aside>
{:else}
	<!-- Collapsed -->
	<aside class="flex h-screen w-16 flex-col items-center border-r border-sidebar-border bg-sidebar py-4 transition-all duration-300 ease-in-out">
		<button 
			onclick={() => sidebarOpen.toggle()}
			class="mb-6 rounded-md p-2 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all active:scale-95"
		>
			<Icon name="menu" size={22} />
		</button>

		<a href="/" class={cn(
			"mb-4 rounded-xl p-3 transition-all active:scale-95",
			currentPath === '/' 
				? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
				: "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
		)} title="Dashboard">
			<Icon name="dashboard" size={20} />
		</a>
		
		<div class="flex flex-col items-center gap-1 mt-6 w-full px-2">
			{#each resourceGroups as group}
				<button 
					onclick={() => { sidebarOpen.set(true); expandedGroups[group.name] = true; }}
					class="p-2.5 text-muted-foreground hover:text-primary transition-colors duration-200"
					title={group.name}
				>
					{#if GroupIcons[group.name]}
						<Icon name={GroupIcons[group.name]} size={18} />
					{/if}
				</button>
			{/each}
		</div>
	</aside>
{/if}

<style>
	/* Hide scrollbar but keep functionality */
	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}
	.scrollbar-hide {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
</style>
