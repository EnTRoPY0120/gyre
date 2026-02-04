<script lang="ts" generics="T">
	import { onMount } from 'svelte';

	interface Props<T> {
		items: T[];
		itemHeight: number;
		buffer?: number;
		class?: string;
		children: import('svelte').Snippet<[T, number]>;
	}

	let { items, itemHeight, buffer = 5, class: className, children }: Props<T> = $props();

	let container: HTMLDivElement | undefined = $state();
	let scrollTop = $state(0);
	let containerHeight = $state(0);

	const startIndex = $derived(Math.max(0, Math.floor(scrollTop / itemHeight) - buffer));
	const endIndex = $derived(
		Math.min(items.length, Math.floor((scrollTop + containerHeight) / itemHeight) + buffer)
	);

	const visibleItems = $derived(
		items.slice(startIndex, endIndex).map((item, i) => ({
			item,
			index: startIndex + i,
			top: (startIndex + i) * itemHeight
		}))
	);

	const totalHeight = $derived(items.length * itemHeight);

	function handleScroll(e: Event) {
		const target = e.target as HTMLDivElement;
		scrollTop = target.scrollTop;
	}

	onMount(() => {
		if (container) {
			const resizeObserver = new ResizeObserver((entries) => {
				for (const entry of entries) {
					containerHeight = entry.contentRect.height;
				}
			});
			resizeObserver.observe(container);
			return () => resizeObserver.disconnect();
		}
	});
</script>

<div
	bind:this={container}
	class="virtual-list-container relative overflow-y-auto {className}"
	onscroll={handleScroll}
>
	<div
		class="virtual-list-phantom absolute top-0 left-0 w-full"
		style="height: {totalHeight}px"
	></div>
	<div class="virtual-list-content absolute top-0 left-0 w-full">
		{#each visibleItems as { item, index, top } (index)}
			<div
				class="virtual-list-item absolute left-0 w-full"
				style="top: {top}px; height: {itemHeight}px"
			>
				{@render children(item, index)}
			</div>
		{/each}
	</div>
</div>

<style>
	.virtual-list-container {
		will-change: transform;
	}
	.virtual-list-item {
		will-change: transform;
	}
</style>
