<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import * as Dialog from '$lib/components/ui/dialog';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { resourceGroups } from '$lib/config/resources';
	import Fuse from 'fuse.js';
	import { commandPaletteOpen } from '$lib/stores/commandPalette';

	interface CommandItem {
		id: string;
		label: string;
		description?: string;
		icon: string;
		href?: string;
		action?: () => void;
		category: string;
		keywords?: string[];
	}

	let open = $state(false);
	let searchQuery = $state('');
	let selectedIndex = $state(0);
	let listEl = $state<HTMLElement | null>(null);
	let inputEl = $state<HTMLInputElement | null>(null);

	const userRole = $derived($page.data.user?.role || 'viewer');
	const isAdmin = $derived(userRole === 'admin');
	const canCreate = $derived(userRole === 'admin' || userRole === 'editor');

	const allItems = $derived.by(() => {
		const items: CommandItem[] = [];
		items.push({ id: 'nav-dashboard', label: 'Dashboard', description: 'View cluster overview and status', icon: 'dashboard', href: '/', category: 'Navigation' });
		items.push({ id: 'nav-inventory', label: 'Inventory', description: 'View resource inventory tree', icon: 'network', href: '/inventory', category: 'Navigation' });
		if (canCreate) items.push({ id: 'nav-create', label: 'Create Resource', description: 'Create a new FluxCD resource', icon: 'plus', href: '/create', category: 'Navigation', keywords: ['new', 'add'] });

		for (const group of resourceGroups) {
			for (const resource of group.resources) {
				items.push({ id: `resource-${resource.type}`, label: resource.displayName, description: resource.description, icon: getResourceIcon(resource.type), href: `/resources/${resource.type}`, category: 'Resources', keywords: [group.name, resource.kind] });
			}
		}

		if (isAdmin) {
			items.push(
				{ id: 'admin-users', label: 'Manage Users', description: 'View and manage user accounts', icon: 'users', href: '/admin/users', category: 'Admin' },
				{ id: 'admin-clusters', label: 'Manage Clusters', description: 'Configure multi-cluster access', icon: 'server', href: '/admin/clusters', category: 'Admin' },
				{ id: 'admin-auth-providers', label: 'Auth Providers', description: 'Configure SSO and OAuth providers', icon: 'key', href: '/admin/auth-providers', category: 'Admin' },
				{ id: 'admin-settings', label: 'Settings', description: 'Application settings and configuration', icon: 'settings', href: '/admin/settings', category: 'Admin' },
				{ id: 'admin-policies', label: 'RBAC Policies', description: 'Manage role-based access control', icon: 'shield-check', href: '/admin/policies', category: 'Admin' }
			);
		}
		return items;
	});

	const fuse = new Fuse<CommandItem>([], { keys: [{ name: 'label', weight: 2 }, { name: 'description', weight: 1 }, { name: 'category', weight: 0.5 }, { name: 'keywords', weight: 1.5 }], threshold: 0.4, includeScore: true });
	$effect(() => { fuse.setCollection(allItems); });

	const filteredItems = $derived.by(() => {
		if (searchQuery.trim() === '') return allItems;
		return fuse.search(searchQuery).map((r) => r.item);
	});

	// Group for display only
	const groupedItems = $derived.by(() => {
		const groups = new Map<string, CommandItem[]>();
		for (const item of filteredItems) {
			if (!groups.has(item.category)) groups.set(item.category, []);
			groups.get(item.category)!.push(item);
		}
		return groups;
	});

	// Reset selection when search changes
	$effect(() => {
		void filteredItems; // depend on filtered list
		selectedIndex = 0;
	});

	// Scroll selected item into view when navigating with keyboard
	async function scrollSelectedIntoView() {
		await tick();
		listEl?.querySelector('[data-selected]')?.scrollIntoView({ block: 'nearest' });
	}

	function handleInputKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			selectedIndex = Math.min(selectedIndex + 1, filteredItems.length - 1);
			scrollSelectedIntoView();
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedIndex = Math.max(selectedIndex - 1, 0);
			scrollSelectedIntoView();
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const item = filteredItems[selectedIndex];
			if (item) handleSelect(item);
		}
	}

	function handleSelect(item: CommandItem) {
		open = false;
		searchQuery = '';
		if (item.action) item.action();
		else if (item.href) goto(item.href);
	}

	function handleOpenChange(isOpen: boolean) {
		if (!isOpen) {
			searchQuery = '';
			selectedIndex = 0;
			commandPaletteOpen.close();
		} else {
			tick().then(() => inputEl?.focus());
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
			e.preventDefault();
			open = !open;
		}
	}

	function getResourceIcon(type: string): string {
		const iconMap: Record<string, string> = { gitrepositories: 'git-branch', helmrepositories: 'library', helmcharts: 'package', buckets: 'bucket', ocirepositories: 'cloud', kustomizations: 'file-cog', helmreleases: 'ship', alerts: 'shield-alert', providers: 'radio', receivers: 'activity', imagerepositories: 'cloud', imagepolicies: 'shield-alert', imageupdateautomations: 'refresh-cw' };
		return iconMap[type] || 'file';
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
		const unsubscribe = commandPaletteOpen.subscribe((v) => { if (v && !open) open = true; });
		return unsubscribe;
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') window.removeEventListener('keydown', handleKeydown);
	});

	// Flat index for a grouped item
	function flatIndex(category: string, idxInGroup: number): number {
		let offset = 0;
		for (const [cat, items] of groupedItems) {
			if (cat === category) return offset + idxInGroup;
			offset += items.length;
		}
		return offset + idxInGroup;
	}
</script>

<Dialog.Dialog bind:open onOpenChange={handleOpenChange}>
	<Dialog.DialogContent class="p-0 shadow-2xl max-w-2xl">
		<div class="flex h-full w-full flex-col overflow-hidden rounded-lg bg-zinc-900 text-zinc-50">
			<!-- Search input -->
			<div class="flex items-center border-b border-zinc-800 px-3">
				<Icon name="search" size={18} class="mr-2 shrink-0 opacity-50" />
				<input
					bind:this={inputEl}
					bind:value={searchQuery}
					onkeydown={handleInputKeydown}
					class="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-zinc-500"
					placeholder="Search commands, resources, and navigation..."
					autocomplete="off"
					spellcheck={false}
				/>
			</div>

			<!-- Results -->
			<div bind:this={listEl} class="max-h-[500px] overflow-y-auto overflow-x-hidden">
				{#if filteredItems.length === 0}
					<p class="py-6 text-center text-sm text-zinc-500">No results found.</p>
				{:else}
					{#each [...groupedItems.entries()] as [category, items], gi (category)}
						{#if gi > 0}
							<div class="mx-2 my-1 h-px bg-zinc-800"></div>
						{/if}
						<div class="px-2 pb-1 pt-2 text-xs font-semibold text-zinc-500">
							{category} <span class="text-zinc-600">({items.length})</span>
						</div>
						{#each items as item, i (item.id)}
							{@const idx = flatIndex(category, i)}
							{@const isSelected = selectedIndex === idx}
							<button
								type="button"
								data-selected={isSelected ? '' : undefined}
								class="relative flex w-full cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none transition-colors {isSelected ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-50'}"
								onclick={() => handleSelect(item)}
								onmouseenter={() => { selectedIndex = idx; }}
							>
								<Icon name={item.icon} size={16} class="shrink-0 opacity-70" />
								<div class="flex flex-1 flex-col gap-0.5 text-left">
									<span class="font-medium">{item.label}</span>
									{#if item.description}
										<span class="text-xs {isSelected ? 'text-zinc-400' : 'text-zinc-500'}">{item.description}</span>
									{/if}
								</div>
								<kbd class="hidden h-5 shrink-0 items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 font-mono text-[10px] font-medium text-zinc-400 sm:flex">
									<span class="text-xs">↵</span>
								</kbd>
							</button>
						{/each}
					{/each}
				{/if}
			</div>

			<!-- Footer -->
			<div class="flex items-center justify-between border-t border-zinc-800 px-3 py-2 text-xs text-zinc-500">
				<div class="flex items-center gap-4">
					<div class="flex items-center gap-1.5">
						<kbd class="flex h-5 items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 font-mono text-[10px] font-medium">↑↓</kbd>
						<span>Navigate</span>
					</div>
					<div class="flex items-center gap-1.5">
						<kbd class="flex h-5 items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 font-mono text-[10px] font-medium">↵</kbd>
						<span>Select</span>
					</div>
					<div class="flex items-center gap-1.5">
						<kbd class="flex h-5 items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 font-mono text-[10px] font-medium">ESC</kbd>
						<span>Close</span>
					</div>
				</div>
				<div class="flex items-center gap-1.5">
					<span>Press</span>
					<kbd class="flex h-5 items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 font-mono text-[10px] font-medium">
						{#if typeof navigator !== 'undefined' && ((navigator as any).userAgentData?.platform ?? navigator.platform)?.toLowerCase().includes('mac')}⌘K{:else}Ctrl+K{/if}
					</kbd>
					<span>anytime</span>
				</div>
			</div>
		</div>
	</Dialog.DialogContent>
</Dialog.Dialog>
