<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Command from '$lib/components/ui/command';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { resourceGroups } from '$lib/config/resources';
	import Fuse from 'fuse.js';

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
	let filteredItems = $state<CommandItem[]>([]);

	// Get user role from page data
	const userRole = $derived($page.data.user?.role || 'viewer');
	const isAdmin = $derived(userRole === 'admin');
	const canCreate = $derived(userRole === 'admin' || userRole === 'editor');

	// Build command items
	const allItems = $derived.by(() => {
		const items: CommandItem[] = [];

		// Navigation items
		items.push({
			id: 'nav-dashboard',
			label: 'Dashboard',
			description: 'View cluster overview and status',
			icon: 'dashboard',
			href: '/',
			category: 'Navigation'
		});

		items.push({
			id: 'nav-inventory',
			label: 'Inventory',
			description: 'View resource inventory tree',
			icon: 'network',
			href: '/inventory',
			category: 'Navigation'
		});

		if (canCreate) {
			items.push({
				id: 'nav-create',
				label: 'Create Resource',
				description: 'Create a new FluxCD resource',
				icon: 'plus',
				href: '/create',
				category: 'Navigation',
				keywords: ['new', 'add']
			});
		}

		// Resource types
		for (const group of resourceGroups) {
			for (const resource of group.resources) {
				items.push({
					id: `resource-${resource.type}`,
					label: resource.displayName,
					description: resource.description,
					icon: getResourceIcon(resource.type),
					href: `/resources/${resource.type}`,
					category: 'Resources',
					keywords: [group.name, resource.kind]
				});
			}
		}

		// Admin items
		if (isAdmin) {
			items.push(
				{
					id: 'admin-users',
					label: 'Manage Users',
					description: 'View and manage user accounts',
					icon: 'users',
					href: '/admin/users',
					category: 'Admin'
				},
				{
					id: 'admin-clusters',
					label: 'Manage Clusters',
					description: 'Configure multi-cluster access',
					icon: 'server',
					href: '/admin/clusters',
					category: 'Admin'
				},
				{
					id: 'admin-auth-providers',
					label: 'Auth Providers',
					description: 'Configure SSO and OAuth providers',
					icon: 'key',
					href: '/admin/auth-providers',
					category: 'Admin'
				},
				{
					id: 'admin-settings',
					label: 'Settings',
					description: 'Application settings and configuration',
					icon: 'settings',
					href: '/admin/settings',
					category: 'Admin'
				},
				{
					id: 'admin-policies',
					label: 'RBAC Policies',
					description: 'Manage role-based access control',
					icon: 'shield-check',
					href: '/admin/policies',
					category: 'Admin'
				}
			);
		}

		return items;
	});

	// Fuse.js configuration for fuzzy search
	const fuse = $derived(
		new Fuse(allItems, {
			keys: [
				{ name: 'label', weight: 2 },
				{ name: 'description', weight: 1 },
				{ name: 'category', weight: 0.5 },
				{ name: 'keywords', weight: 1.5 }
			],
			threshold: 0.4,
			includeScore: true
		})
	);

	// Filter items based on search query
	$effect(() => {
		if (searchQuery.trim() === '') {
			filteredItems = allItems;
		} else {
			const results = fuse.search(searchQuery);
			filteredItems = results.map((r) => r.item);
		}
	});

	// Group items by category
	const groupedItems = $derived.by(() => {
		const groups = new Map<string, CommandItem[]>();
		for (const item of filteredItems) {
			if (!groups.has(item.category)) {
				groups.set(item.category, []);
			}
			groups.get(item.category)!.push(item);
		}
		return groups;
	});

	// Helper to get resource icon
	function getResourceIcon(type: string): string {
		const iconMap: Record<string, string> = {
			gitrepositories: 'git-branch',
			helmrepositories: 'library',
			helmcharts: 'package',
			buckets: 'bucket',
			ocirepositories: 'cloud',
			kustomizations: 'file-cog',
			helmreleases: 'ship',
			alerts: 'shield-alert',
			providers: 'radio',
			receivers: 'activity',
			imagerepositories: 'cloud',
			imagepolicies: 'shield-alert',
			imageupdateautomations: 'refresh-cw'
		};
		return iconMap[type] || 'file';
	}

	// Handle item selection
	function handleSelect(item: CommandItem) {
		open = false;
		searchQuery = '';

		if (item.action) {
			item.action();
		} else if (item.href) {
			goto(item.href);
		}
	}

	// Keyboard shortcut handler
	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
			e.preventDefault();
			open = !open;
		}

		// ESC to close
		if (e.key === 'Escape' && open) {
			open = false;
			searchQuery = '';
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('keydown', handleKeydown);
		}
	});
</script>

<Dialog.Dialog bind:open>
	<Dialog.DialogContent class="p-0 shadow-2xl max-w-2xl">
		<Command.Command class="rounded-lg border-0">
			<Command.CommandInput
				bind:value={searchQuery}
				placeholder="Search commands, resources, and navigation..."
				autofocus
			/>
			<Command.CommandList class="max-h-[500px]">
				<Command.CommandEmpty>No results found.</Command.CommandEmpty>

				{#each [...groupedItems.entries()] as [category, items] (category)}
					<Command.CommandGroup>
						<div data-command-group-heading class="flex items-center gap-2">
							<span>{category}</span>
							<span class="text-xs text-zinc-600">({items.length})</span>
						</div>
						{#each items as item (item.id)}
							<Command.CommandItem
								value={item.label}
								onSelect={() => handleSelect(item)}
								class="cursor-pointer"
							>
								<Icon name={item.icon} size={16} class="opacity-70" />
								<div class="flex flex-col flex-1 gap-0.5">
									<span class="font-medium">{item.label}</span>
									{#if item.description}
										<span class="text-xs text-zinc-500">{item.description}</span>
									{/if}
								</div>
								<kbd
									class="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 font-mono text-[10px] font-medium text-zinc-400 opacity-100 sm:flex"
								>
									<span class="text-xs">↵</span>
								</kbd>
							</Command.CommandItem>
						{/each}
					</Command.CommandGroup>

					{#if category !== [...groupedItems.keys()].at(-1)}
						<Command.CommandSeparator />
					{/if}
				{/each}
			</Command.CommandList>

			<!-- Footer with keyboard shortcuts hint -->
			<div
				class="flex items-center justify-between border-t border-zinc-800 px-3 py-2 text-xs text-zinc-500"
			>
				<div class="flex items-center gap-4">
					<div class="flex items-center gap-1.5">
						<kbd
							class="flex h-5 items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 font-mono text-[10px] font-medium"
						>
							↑↓
						</kbd>
						<span>Navigate</span>
					</div>
					<div class="flex items-center gap-1.5">
						<kbd
							class="flex h-5 items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 font-mono text-[10px] font-medium"
						>
							↵
						</kbd>
						<span>Select</span>
					</div>
					<div class="flex items-center gap-1.5">
						<kbd
							class="flex h-5 items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 font-mono text-[10px] font-medium"
						>
							ESC
						</kbd>
						<span>Close</span>
					</div>
				</div>
				<div class="flex items-center gap-1.5">
					<span>Press</span>
					<kbd
						class="flex h-5 items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 font-mono text-[10px] font-medium"
					>
						{#if typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac')}
							⌘K
						{:else}
							Ctrl+K
						{/if}
					</kbd>
					<span>anytime</span>
				</div>
			</div>
		</Command.Command>
	</Dialog.DialogContent>
</Dialog.Dialog>
