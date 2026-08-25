<script lang="ts">
	import type { HighlightSegment } from './CommandPaletteTypes';

	let {
		segments,
		highlightedClass
	}: {
		segments: HighlightSegment[];
		highlightedClass: string;
	} = $props();
</script>

{#each segments as segment}
	{#if segment.highlighted}
		<mark class="rounded-sm bg-transparent px-0 not-italic {highlightedClass}">{segment.text}</mark>
	{:else}
		{segment.text}
	{/if}
{/each}
