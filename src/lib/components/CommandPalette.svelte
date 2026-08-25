<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import * as Dialog from '$lib/components/ui/dialog';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { resourceGroups } from '$lib/config/resources';
	import Fuse from 'fuse.js';
	import { commandPaletteOpen } from '$lib/stores/commandPalette';
	import CommandPaletteFooter from './CommandPaletteFooter.svelte';
	import CommandPaletteResults from './CommandPaletteResults.svelte';
	import type { CommandItem, SearchResult } from './CommandPaletteTypes';
	import { highlightText } from './command-palette-highlighting';

	let open = $state(false);
	let searchQuery = $state('');
	let selectedIndex = $state(0);
	let listEl = $state<HTMLElement | null>(null);
	let inputEl = $state<HTMLInputElement | null>(null);

	const userRole = $derived($page.data.user?.role || 'viewer');
	const isAdmin = $derived(userRole === 'admin');
	const canCreate = $derived(userRole === 'admin' || userRole === 'editor');

	const allItems = $derived.by(() => {
		const items: CommandItem[] = [
			{
				id: 'nav-dashboard',
				label: 'Dashboard',
				description: 'View cluster overview and status',
				icon: 'dashboard',
				href: '/',
				category: 'Navigation'
			}
		];
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

	const fuse = new Fuse<CommandItem>([], {
		keys: [
			{ name: 'label', weight: 2 },
			{ name: 'description', weight: 1 },
			{ name: 'category', weight: 0.5 },
			{ name: 'keywords', weight: 1.5 }
		],
		threshold: 0.4,
		includeScore: true,
		includeMatches: true
	});
	$effect(() => fuse.setCollection(allItems));

	const filteredItems = $derived.by((): SearchResult[] => {
		if (searchQuery.trim() === '') {
			return allItems.map((item) => ({
				item,
				labelSegments: [{ text: item.label, highlighted: false }],
				descSegments: item.description
					? [{ text: item.description, highlighted: false }]
					: null,
				labelKeyword: false,
				descKeyword: false
			}));
		}
		return fuse.search(searchQuery).map((result) => {
			const labelMatch = result.matches?.find((match) => match.key === 'label');
			const descMatch = result.matches?.find((match) => match.key === 'description');
			return {
				item: result.item,
				labelSegments: highlightText(
					result.item.label,
					labelMatch?.indices as readonly [number, number][] | undefined
				),
				descSegments: result.item.description
					? highlightText(
							result.item.description,
							descMatch?.indices as readonly [number, number][] | undefined
						)
					: null,
				labelKeyword: isKeywordMatch(result.item.label, searchQuery),
				descKeyword: isKeywordMatch(result.item.description ?? '', searchQuery)
			};
		});
	});

	const groupedItems = $derived.by(() => {
		const groups = new Map<string, SearchResult[]>();
		for (const result of filteredItems) {
			const category = result.item.category;
			if (!groups.has(category)) groups.set(category, []);
			groups.get(category)!.push(result);
		}
		return groups;
	});

	function isKeywordMatch(text: string, query: string): boolean {
		const trimmed = query.trim().toLowerCase();
		return trimmed.length > 0 && text.toLowerCase().includes(trimmed);
	}

	$effect(() => {
		void filteredItems;
		selectedIndex = 0;
	});

	async function scrollSelectedIntoView() {
		await tick();
		listEl?.querySelector('[data-selected]')?.scrollIntoView({ block: 'nearest' });
	}

	function handleInputKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			selectedIndex = Math.min(selectedIndex + 1, filteredItems.length - 1);
			void scrollSelectedIntoView();
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			selectedIndex = Math.max(selectedIndex - 1, 0);
			void scrollSelectedIntoView();
		} else if (event.key === 'Enter') {
			event.preventDefault();
			const result = filteredItems[selectedIndex];
			if (result) handleSelect(result.item);
		}
	}

	function handleSelect(item: CommandItem) {
		open = false;
		searchQuery = '';
		if (item.action) item.action();
		else if (item.href) void goto(item.href);
	}

	function handleOpenChange(isOpen: boolean) {
		if (!isOpen) {
			searchQuery = '';
			selectedIndex = 0;
			commandPaletteOpen.close();
		} else {
			void tick().then(() => inputEl?.focus());
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
			event.preventDefault();
			open = !open;
		}
	}

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
			receivers: 'activity'
		};
		return iconMap[type] || 'file';
	}

	$effect(() => {
		window.addEventListener('keydown', handleKeydown);
		const unsubscribe = commandPaletteOpen.subscribe((value) => {
			untrack(() => {
				if (value && !open) open = true;
			});
		});
		return () => {
			window.removeEventListener('keydown', handleKeydown);
			unsubscribe();
		};
	});

	const flatIndexMap = $derived.by(() => {
		const map = new Map<string, number>();
		let index = 0;
		for (const [, results] of groupedItems) {
			for (const result of results) map.set(result.item.id, index++);
		}
		return map;
	});
</script>

<Dialog.Dialog bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content class="max-w-2xl p-0 shadow-2xl">
		<div class="flex h-full w-full flex-col overflow-hidden rounded-lg bg-zinc-900 text-zinc-50">
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
			<div bind:this={listEl}>
				<CommandPaletteResults
					{filteredItems}
					{groupedItems}
					{flatIndexMap}
					{selectedIndex}
					onSelect={handleSelect}
					onHover={(index) => (selectedIndex = index)}
				/>
			</div>
			<CommandPaletteFooter />
		</div>
	</Dialog.Content>
</Dialog.Dialog>
