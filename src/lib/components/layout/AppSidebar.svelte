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

	// Tracking which groups are expanded (all collapsed by default)
	let expandedGroups = $state<Record<string, boolean>>({
		Sources: false,
		Kustomize: false,
		Helm: false,
		Notifications: false,
		'Image Automation': false
	});

	function toggleGroup(name: string) {
		expandedGroups[name] = !expandedGroups[name];
	}

	const GroupIcons: Record<string, string> = {
		Sources: 'sideways-git',
		Kustomize: 'kustomize',
		Helm: 'helm',
		Notifications: 'bell',
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
	<aside
		class="relative z-50 flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar/95 text-sidebar-foreground shadow-2xl backdrop-blur-xl transition-all duration-300 ease-in-out"
	>
		<!-- Header -->
		<div class="flex h-16 items-center justify-between border-b border-sidebar-border px-6">
			<a href="/" class="group flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg transition-all group-hover:scale-105"
				>
					<svg class="h-6 w-6 text-slate-900" viewBox="0 0 24 24" fill="currentColor">
						<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
					</svg>
				</div>
				<span class="text-xl font-bold text-foreground">Gyre</span>
			</a>
			<button
				onclick={() => sidebarOpen.toggle()}
				class="rounded-lg p-2 text-muted-foreground transition-all hover:scale-105 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:scale-95"
				title="Collapse Sidebar"
			>
				<Icon name="chevron-right" size={16} class="rotate-180" />
			</button>
		</div>

		<!-- Nav -->
		<div class="scrollbar-hide flex-1 space-y-2 overflow-y-auto px-4 py-6">
			<!-- Dashboard -->
			<a
				href="/"
				class={cn(
					'group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-all duration-300',
					currentPath === '/'
						? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_4px_20px_-4px_rgba(234,179,8,0.2)]'
						: 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
				)}
			>
				<Icon
					name="dashboard"
					size={18}
					class={cn(
						'transition-transform group-hover:scale-110',
						currentPath === '/' && 'animate-pulse'
					)}
				/>
				Dashboard
			</a>

			<!-- Inventory -->
			<a
				href="/inventory"
				class={cn(
					'group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-all duration-300',
					currentPath === '/inventory'
						? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_4px_20px_-4px_rgba(234,179,8,0.2)]'
						: 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
				)}
			>
				<Icon
					name="network"
					size={18}
					class={cn(
						'transition-transform group-hover:scale-110',
						currentPath === '/inventory' && 'animate-pulse'
					)}
				/>
				Inventory
			</a>

			<div class="mx-2 my-2 h-px bg-sidebar-border/50"></div>

			<!-- Create Resource -->
			<a
				href="/create"
				class={cn(
					'group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-all duration-300',
					currentPath.startsWith('/create')
						? 'bg-blue-600 text-white shadow-[0_4px_20px_-4px_rgba(37,99,235,0.3)]'
						: 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-blue-500'
				)}
			>
				<div class="flex size-5 items-center justify-center rounded-md bg-blue-500/10 transition-colors group-hover:bg-blue-500 group-hover:text-white">
					<Icon name="plus" size={14} strokeWidth={3} />
				</div>
				Create Resource
			</a>

			<div class="mx-2 my-2 h-px bg-sidebar-border/50"></div>

			<!-- Groups -->
			{#each resourceGroups as group}
				<div class="space-y-1">
					<button
						onclick={() => toggleGroup(group.name)}
						class="group flex w-full items-center justify-between px-3 py-2 font-display text-[10px] font-black tracking-[0.2em] text-muted-foreground uppercase transition-colors hover:text-primary"
					>
						<div class="flex items-center gap-2.5">
							{#if GroupIcons[group.name]}
								<Icon
									name={GroupIcons[group.name]}
									size={14}
									class="opacity-50 transition-all group-hover:text-primary group-hover:opacity-100"
								/>
							{/if}
							{group.name}
						</div>
						<Icon
							name="chevron-right"
							size={12}
							class={cn(
								'text-muted-foreground/50 transition-transform duration-300 group-hover:text-primary',
								expandedGroups[group.name] ? 'rotate-90' : 'rotate-0'
							)}
						/>
					</button>

					{#if expandedGroups[group.name]}
						<div class="relative ml-2 space-y-1 border-l border-sidebar-border/30 pl-3">
							<!-- Active indicator line -->
							<div
								class="absolute top-0 bottom-0 left-[-1px] w-[1px] bg-gradient-to-b from-primary/0 via-primary/0 to-primary/0 transition-all duration-300 group-hover:via-primary/50"
							></div>

							{#each group.resources as resource}
								{@const iconName = ResourceIcons[resource.type] || 'file-cog'}
								{@const active = isActive(resource.type)}
								<a
									href="/resources/{resource.type}"
									class={cn(
										'group/item relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200',
										active
											? 'border border-primary/20 bg-primary/10 text-primary'
											: 'text-muted-foreground/80 hover:bg-sidebar-accent/50 hover:text-foreground'
									)}
								>
									{#if active}
										<div class="absolute inset-0 animate-pulse bg-primary/5"></div>
									{/if}
									<Icon
										name={iconName}
										size={16}
										class={cn(
											'transition-transform duration-300 group-hover/item:scale-110',
											active && 'text-primary'
										)}
									/>
									<span class="relative z-10">{resource.displayName}</span>
									{#if active}
										<div
											class="absolute right-2 size-1.5 rounded-full bg-primary shadow-[0_0_5px_rgba(234,179,8,0.5)]"
										></div>
									{/if}
								</a>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Footer -->
		<div class="border-t border-sidebar-border bg-sidebar/50 p-4 backdrop-blur-md">
			<div
				class="group flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/20 p-3.5 transition-all hover:border-primary/30 hover:bg-sidebar-accent/40"
			>
				<div
					class="flex h-9 w-9 items-center justify-center rounded-lg border border-sidebar-primary/20 bg-sidebar-primary/10 text-xs font-black text-sidebar-primary shadow-inner transition-transform group-hover:scale-110"
				>
					FL
				</div>
				<div class="flex-1 overflow-hidden">
					<p class="truncate text-xs font-bold tracking-wide text-foreground uppercase">
						Flux Controller
					</p>
					<div class="mt-0.5 flex items-center gap-1.5">
						<div
							class="size-1.5 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
						></div>
						<p
							class="truncate font-mono text-[10px] font-medium text-muted-foreground transition-colors group-hover:text-primary"
						>
							{fluxVersion}
						</p>
					</div>
				</div>
			</div>
		</div>
	</aside>
{:else}
	<!-- Collapsed -->
	<aside
		class="flex h-screen w-16 flex-col items-center border-r border-sidebar-border bg-sidebar py-4 transition-all duration-300 ease-in-out"
	>
		<button
			onclick={() => sidebarOpen.toggle()}
			class="mb-6 rounded-md p-2 text-muted-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:scale-95"
		>
			<Icon name="menu" size={22} />
		</button>

		<a
			href="/"
			class={cn(
				'mb-4 rounded-xl p-3 transition-all active:scale-95',
				currentPath === '/'
					? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
					: 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
			)}
			title="Dashboard"
		>
			<Icon name="dashboard" size={20} />
		</a>

		<a
			href="/inventory"
			class={cn(
				'mb-4 rounded-xl p-3 transition-all active:scale-95',
				currentPath === '/inventory'
					? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
					: 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
			)}
			title="Inventory"
		>
			<Icon name="network" size={20} />
		</a>

		<a
			href="/create"
			class={cn(
				'mb-4 rounded-xl p-3 transition-all active:scale-95',
				currentPath.startsWith('/create')
					? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
					: 'text-muted-foreground hover:bg-sidebar-accent hover:text-blue-500'
			)}
			title="Create Resource"
		>
			<Icon name="plus" size={20} />
		</a>

		<div class="mt-6 flex w-full flex-col items-center gap-1 px-2">
			{#each resourceGroups as group}
				<button
					onclick={() => {
						sidebarOpen.set(true);
						expandedGroups[group.name] = true;
					}}
					class="p-2.5 text-muted-foreground transition-colors duration-200 hover:text-primary"
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
