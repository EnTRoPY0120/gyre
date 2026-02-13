<script lang="ts">
	import { page } from '$app/stores';
	import { resourceGroups } from '$lib/config/resources';
	import { sidebarOpen } from '$lib/stores/sidebar';
	import { cn } from '$lib/utils';
	import { FluxResourceType } from '$lib/types/flux';
	import Icon from '$lib/components/ui/Icon.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { fade, fly } from 'svelte/transition';

	import { onMount, onDestroy } from 'svelte';

	const isOpen = $derived($sidebarOpen);
	const currentPath = $derived($page.url.pathname);

	const gyreVersion = $derived($page.data.gyreVersion || '0.0.1');
	const userRole = $derived($page.data.user?.role || 'viewer');
	const isAdmin = $derived(userRole === 'admin');
	const canCreate = $derived(userRole === 'admin' || userRole === 'editor');

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

	function closeMobile() {
		if (isMobile) {
			sidebarOpen.set(false);
		}
	}
</script>

{#if isOpen}
	{#if isMobile}
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
		transition:fly={{ x: -280, duration: 300 }}
		class="fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar/95 text-sidebar-foreground shadow-2xl backdrop-blur-xl transition-all duration-300 ease-in-out lg:relative"
	>
		<!-- Header -->
		<div class="flex h-20 flex-col justify-center border-b border-sidebar-border px-6">
			<div class="flex items-center justify-between">
				<!-- Logo & Brand -->
				<a href="/" class="group flex items-center gap-3" onclick={closeMobile}>
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/20 transition-all group-hover:scale-105 group-hover:shadow-amber-500/30"
					>
						<svg class="h-6 w-6 text-slate-900" viewBox="0 0 24 24" fill="currentColor">
							<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
						</svg>
					</div>
					<div class="flex flex-col">
						<span class="text-xl leading-tight font-bold tracking-tight text-foreground">Gyre</span>
						<div class="mt-0.5">
							<span
								class="inline-flex items-center rounded-md border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-500"
							>
								v{gyreVersion}
							</span>
						</div>
					</div>
				</a>

				<button
					onclick={() => sidebarOpen.toggle()}
					class="rounded-lg p-2 text-muted-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:scale-95"
					title="Collapse Sidebar"
				>
					<Icon name="chevron-right" size={16} class="rotate-180" />
				</button>
			</div>
		</div>

		<!-- Nav -->
		<div class="custom-scrollbar flex-1 space-y-2 overflow-y-auto px-4 py-6">
			<!-- Dashboard -->
			<!-- eslint-disable-next-line -->
			<a
				href="/"
				onclick={closeMobile}
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
			<!-- eslint-disable-next-line -->
			<a
				href="/inventory"
				onclick={closeMobile}
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
			<!-- eslint-disable-next-line -->
			{#if !canCreate}
				<Tooltip.Provider delayDuration={200}>
					<Tooltip.Root>
						<Tooltip.Trigger class="w-full">
							<button
								type="button"
								aria-disabled="true"
								class="group flex w-full cursor-not-allowed items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-muted-foreground opacity-60 transition-all duration-300"
							>
								<div
									class="flex size-5 items-center justify-center rounded-md bg-blue-500/10 transition-colors"
								>
									<Icon name="plus" size={14} />
								</div>
								Create Resource
							</button>
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
					class={cn(
						'group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-all duration-300',
						currentPath.startsWith('/create')
							? 'bg-blue-600 text-white shadow-[0_4px_20px_-4px_rgba(37,99,235,0.3)]'
							: 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-blue-500'
					)}
				>
					<div
						class="flex size-5 items-center justify-center rounded-md bg-blue-500/10 transition-colors group-hover:bg-blue-500 group-hover:text-white"
					>
						<div class="flex items-center gap-2.5">
							<Icon
								name="shield"
								size={14}
								class="opacity-50 transition-all group-hover:text-primary group-hover:opacity-100"
							/>
							Admin
						</div>
						<Icon
							name="chevron-right"
							size={12}
							class={cn(
								'text-muted-foreground/50 transition-transform duration-300 group-hover:text-primary',
								expandedGroups['Admin'] ? 'rotate-90' : 'rotate-0'
							)}
						/>
					</button>

					{#if expandedGroups['Admin']}
						<div class="relative ml-2 space-y-1 border-l border-sidebar-border/30 pl-3">
							<!-- Users -->
							<a
								href="/admin/users"
								class={cn(
									'group/item relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200',
									currentPath === '/admin/users'
										? 'border border-primary/20 bg-primary/10 text-primary'
										: 'text-muted-foreground/80 hover:bg-sidebar-accent/50 hover:text-foreground'
								)}
							>
								{#if currentPath === '/admin/users'}
									<div class="absolute inset-0 animate-pulse bg-primary/5"></div>
								{/if}
								<Icon
									name="users"
									size={16}
									class="transition-transform duration-300 group-hover/item:scale-110"
								/>
								<span class="relative z-10">Users</span>
							</a>

							<!-- Clusters -->
							<a
								href="/admin/clusters"
								class={cn(
									'group/item relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200',
									currentPath === '/admin/clusters'
										? 'border border-primary/20 bg-primary/10 text-primary'
										: 'text-muted-foreground/80 hover:bg-sidebar-accent/50 hover:text-foreground'
								)}
							>
								{#if currentPath === '/admin/clusters'}
									<div class="absolute inset-0 animate-pulse bg-primary/5"></div>
								{/if}
								<Icon
									name="server"
									size={16}
									class="transition-transform duration-300 group-hover/item:scale-110"
								/>
								<span class="relative z-10">Clusters</span>
							</a>

							<!-- Auth Providers -->
							<a
								href="/admin/auth-providers"
								class={cn(
									'group/item relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200',
									currentPath === '/admin/auth-providers'
										? 'border border-primary/20 bg-primary/10 text-primary'
										: 'text-muted-foreground/80 hover:bg-sidebar-accent/50 hover:text-foreground'
								)}
							>
								{#if currentPath === '/admin/auth-providers'}
									<div class="absolute inset-0 animate-pulse bg-primary/5"></div>
								{/if}
								<Icon
									name="key"
									size={16}
									class="transition-transform duration-300 group-hover/item:scale-110"
								/>
								<span class="relative z-10">Auth Providers</span>
							</a>

							<!-- Settings -->
							<a
								href="/admin/settings"
								class={cn(
									'group/item relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200',
									currentPath === '/admin/settings'
										? 'border border-primary/20 bg-primary/10 text-primary'
										: 'text-muted-foreground/80 hover:bg-sidebar-accent/50 hover:text-foreground'
								)}
							>
								{#if currentPath === '/admin/settings'}
									<div class="absolute inset-0 animate-pulse bg-primary/5"></div>
								{/if}
								<Icon
									name="settings"
									size={16}
									class="transition-transform duration-300 group-hover/item:scale-110"
								/>
								<span class="relative z-10">Settings</span>
							</a>

							<!-- Policies -->
							<a
								href="/admin/policies"
								class={cn(
									'group/item relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200',
									currentPath === '/admin/policies'
										? 'border border-primary/20 bg-primary/10 text-primary'
										: 'text-muted-foreground/80 hover:bg-sidebar-accent/50 hover:text-foreground'
								)}
							>
								{#if currentPath === '/admin/policies'}
									<div class="absolute inset-0 animate-pulse bg-primary/5"></div>
								{/if}
								<Icon
									name="shield-check"
									size={16}
									class="transition-transform duration-300 group-hover/item:scale-110"
								/>
								<span class="relative z-10">Policies</span>
							</a>
						</div>
					{/if}
				</div>

				<div class="mx-2 my-2 h-px bg-sidebar-border/50"></div>
						<Icon name="plus" size={14} />
					</div>
					Create Resource
				</a>
			{/if}

			<div class="mx-2 my-2 h-px bg-sidebar-border/50"></div>

			<!-- Groups -->

			{#each resourceGroups as group (group.name)}
				{@const groupId = `panel-${group.name.toLowerCase().replace(/\s+/g, '-')}`}

				<div class="space-y-1">
					<button
						onclick={() => toggleGroup(group.name)}
						aria-expanded={expandedGroups[group.name]}
						aria-controls={groupId}
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
						<div
							id={groupId}
							class="relative ml-2 space-y-1 border-l border-sidebar-border/30 pl-3"
						>
							<!-- Active indicator line -->
							<div
								class="absolute top-0 bottom-0 left-[-1px] w-[1px] bg-gradient-to-b from-primary/0 via-primary/0 to-primary/0 transition-all duration-300 group-hover:via-primary/50"
							></div>

							{#each group.resources as resource (resource.type)}
								{@const iconName = ResourceIcons[resource.type] || 'file-cog'}
								{@const active = isActive(resource.type)}
								<!-- eslint-disable-next-line -->
								<a
									href="/resources/{resource.type}"
									onclick={closeMobile}
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

		<!-- Footer (Pinned) -->
		{#if isAdmin}
			<div class="mt-auto border-t border-sidebar-border/20 px-4 py-4">
				<a
					href="/admin"
					onclick={closeMobile}
					class={cn(
						'group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-all duration-300',
						currentPath.startsWith('/admin')
							? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_4px_20px_-4px_rgba(234,179,8,0.2)]'
							: 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
					)}
				>
					<Icon
						name="settings"
						size={18}
						class={cn(
							'transition-transform group-hover:scale-110',
							currentPath.startsWith('/admin') && 'animate-pulse'
						)}
					/>
					Settings
				</a>
			</div>
		{/if}
	</aside>
{:else}
	<!-- Collapsed (Desktop only) -->
	<aside
		class="hidden h-screen w-16 flex-col items-center border-r border-sidebar-border bg-sidebar py-4 transition-all duration-300 ease-in-out lg:flex"
	>
		<button
			onclick={() => sidebarOpen.toggle()}
			class="mb-6 rounded-md p-2 text-muted-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:scale-95"
		>
			<Icon name="menu" size={22} />
		</button>

		<div class="custom-scrollbar flex flex-1 flex-col items-center overflow-y-auto">
			<!-- eslint-disable-next-line -->
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

			<!-- eslint-disable-next-line -->
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

			<!-- eslint-disable-next-line -->
			{#if !canCreate}
				<Tooltip.Provider delayDuration={200}>
					<Tooltip.Root>
						<Tooltip.Trigger>
							<button
								type="button"
								aria-disabled="true"
								class="mb-4 cursor-not-allowed rounded-xl bg-gray-200 p-3 text-gray-400 transition-all dark:bg-gray-800"
								title="Create Resource (Disabled)"
							>
								<Icon name="plus" size={20} />
							</button>
						</Tooltip.Trigger>
						<Tooltip.Content side="right">
							<p class="text-xs text-white">You need additional permissions to create resources.</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>
			{:else}
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
			{/if}

			<div class="mt-6 flex w-full flex-col items-center gap-1 px-2">
				{#each resourceGroups as group (group.name)}
					<button
						onclick={() => {
							sidebarOpen.set(true);
							expandedGroups[group.name] = true;
						}}
						class="p-2.5 text-muted-foreground transition-colors duration-200 hover:text-primary"
						title={group.name}
						aria-label={group.name}
					>
						{#if GroupIcons[group.name]}
							<Icon name={GroupIcons[group.name]} size={18} />
						{/if}
					</button>
				{/each}
			</div>
		</div>

		<!-- Footer (Pinned) -->
		{#if isAdmin}
			<div class="mt-auto border-t border-sidebar-border/20 py-4">
				<a
					href="/admin"
					class={cn(
						'rounded-xl p-3 transition-all active:scale-95',
						currentPath.startsWith('/admin')
							? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
							: 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
					)}
					title="Settings"
				>
					<Icon name="settings" size={20} />
				</a>
			</div>
		{/if}
	</aside>
{/if}

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
