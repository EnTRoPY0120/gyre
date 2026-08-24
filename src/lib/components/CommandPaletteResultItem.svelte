<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { SearchResult } from './CommandPaletteTypes';

	let {
		result,
		selected,
		onSelect,
		onHover
	}: {
		result: SearchResult;
		selected: boolean;
		onSelect: () => void;
		onHover: () => void;
	} = $props();
</script>

<button
	type="button"
	data-selected={selected ? '' : undefined}
	class="relative flex w-full cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none transition-colors {selected
		? 'bg-zinc-800 text-zinc-50'
		: 'text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-50'}"
	onclick={onSelect}
	onmouseenter={onHover}
>
	<Icon name={result.item.icon} size={16} class="shrink-0 opacity-70" />
	<div class="flex flex-1 flex-col gap-0.5 text-left">
		<span class="font-medium">
			{#each result.labelSegments as segment}
				{#if segment.highlighted}
					<mark
						class="rounded-sm bg-transparent px-0 font-semibold not-italic {result.labelKeyword
							? 'text-amber-300'
							: 'text-sky-300'}"
						>{segment.text}</mark
					>
				{:else}
					{segment.text}
				{/if}
			{/each}
		</span>
		{#if result.item.description && result.descSegments}
			<span class="text-xs {selected ? 'text-zinc-400' : 'text-zinc-500'}">
				{#each result.descSegments as segment}
					{#if segment.highlighted}
						<mark
							class="rounded-sm bg-transparent px-0 not-italic {result.descKeyword
								? 'text-amber-400'
								: 'text-sky-400'}"
							>{segment.text}</mark
						>
					{:else}
						{segment.text}
					{/if}
				{/each}
			</span>
		{/if}
	</div>
	<kbd
		class="hidden h-5 shrink-0 items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 font-mono text-[10px] font-medium text-zinc-400 sm:flex"
	>
		<span class="text-xs">↵</span>
	</kbd>
</button>
