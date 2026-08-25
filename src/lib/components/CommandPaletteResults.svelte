<script lang="ts">
	import type { SearchResult } from './CommandPaletteTypes';
	import CommandPaletteResultItem from './CommandPaletteResultItem.svelte';

	let {
		filteredItems,
		groupedItems,
		flatIndexMap,
		selectedIndex,
		onSelect,
		onHover
	}: {
		filteredItems: SearchResult[];
		groupedItems: Map<string, SearchResult[]>;
		flatIndexMap: Map<string, number>;
		selectedIndex: number;
		onSelect: (item: SearchResult['item']) => void;
		onHover: (index: number) => void;
	} = $props();
</script>

<div class="max-h-[500px] overflow-y-auto overflow-x-hidden">
	{#if filteredItems.length === 0}
		<p class="py-6 text-center text-sm text-zinc-500">No results found.</p>
	{:else}
		{#each [...groupedItems.entries()] as [category, results], groupIndex (category)}
			{#if groupIndex > 0}
				<div class="mx-2 my-1 h-px bg-zinc-800"></div>
			{/if}
			<div class="px-2 pt-2 pb-1 text-xs font-semibold text-zinc-500">
				{category} <span class="text-zinc-600">({results.length})</span>
			</div>
			{#each results as result (result.item.id)}
				{@const index = flatIndexMap.get(result.item.id) ?? 0}
				<CommandPaletteResultItem
					{result}
					selected={selectedIndex === index}
					onSelect={() => onSelect(result.item)}
					onHover={() => onHover(index)}
				/>
			{/each}
		{/each}
	{/if}
</div>
