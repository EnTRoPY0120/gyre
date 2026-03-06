<script lang="ts">
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import { Check } from 'lucide-svelte';
	import { Select as SelectPrimitive } from 'bits-ui';
	import type { Snippet } from 'svelte';

	let {
		ref = $bindable(null),
		class: className,
		children: childrenProp,
		...restProps
	}: WithoutChildrenOrChild<SelectPrimitive.ItemProps> & {
		children?: Snippet<[{ selected: boolean; highlighted: boolean }]>;
	} = $props();
</script>

<SelectPrimitive.Item
	bind:ref
	data-slot="select-item"
	class={cn(
		'relative flex w-full cursor-default items-center rounded-lg py-1.5 ps-2 pe-8 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 transition-colors',
		className
	)}
	{...restProps}
>
	{#snippet children({ selected, highlighted })}
		{@render childrenProp?.({ selected, highlighted })}
		{#if selected}
			<span class="absolute right-2 flex size-3.5 items-center justify-center">
				<Check class="size-4" />
			</span>
		{/if}
	{/snippet}
</SelectPrimitive.Item>
