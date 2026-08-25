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
	import { buildCommandItems } from './command-palette-items';
import { buildCommandPaletteSearchResult } from './command-palette-search';
import {
	applyCommandPaletteKeyAction,
	getCommandPaletteKeyAction
} from './command-palette-keyboard';

	let open = $state(false);
	let searchQuery = $state('');
	let selectedIndex = $state(0);
	let listEl = $state<HTMLElement | null>(null);
	let inputEl = $state<HTMLInputElement | null>(null);

	const userRole = $derived($page.data.user?.role || 'viewer');
	const isAdmin = $derived(userRole === 'admin');
	const canCreate = $derived(userRole === 'admin' || userRole === 'editor');

	const allItems = $derived.by(() => buildCommandItems(resourceGroups, { isAdmin, canCreate }));

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
		return fuse.search(searchQuery).map((result) =>
			buildCommandPaletteSearchResult(
				result.item,
				result.matches?.find((match) => match.key === 'label')?.indices as
					| readonly [number, number][]
					| undefined,
				result.matches?.find((match) => match.key === 'description')?.indices as
					| readonly [number, number][]
					| undefined,
				searchQuery
			)
		);
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

	$effect(() => {
		void filteredItems;
		selectedIndex = 0;
	});

	async function scrollSelectedIntoView() {
		await tick();
		listEl?.querySelector('[data-selected]')?.scrollIntoView({ block: 'nearest' });
	}

	function handleInputKeydown(event: KeyboardEvent) {
		const action = getCommandPaletteKeyAction(event.key, selectedIndex, filteredItems.length);
		if (!action.preventDefault) return;

		event.preventDefault();
		applyCommandPaletteKeyAction(
			action,
			(index) => {
				selectedIndex = index;
				void scrollSelectedIntoView();
			},
			() => handleSelect(filteredItems[selectedIndex]?.item)
		);
	}

	function handleSelect(item: CommandItem | undefined) {
		if (!item) return;
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
