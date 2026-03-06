<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { Select as SelectPrimitive } from 'bits-ui';
	import ScrollDownButton from './select-scroll-down-button.svelte';
	import ScrollUpButton from './select-scroll-up-button.svelte';

	let {
		ref = $bindable(null),
		class: className,
		children,
		sideOffset = 4,
		side = 'bottom',
		align = 'start',
		...restProps
	}: SelectPrimitive.ContentProps = $props();
</script>

<SelectPrimitive.Portal>
	<SelectPrimitive.Content
		bind:ref
		data-slot="select-content"
		{sideOffset}
		{side}
		{align}
		class={cn(
			'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-end-2 data-[side=right]:slide-in-from-start-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-96 w-(--bits-select-trigger-width) min-w-(--bits-select-trigger-width) overflow-hidden rounded-xl border border-border/60 bg-background/95 p-1 text-popover-foreground shadow-2xl backdrop-blur-xl',
			className
		)}
		{...restProps}
	>
		<ScrollUpButton />
		<SelectPrimitive.Viewport
			class={cn('p-1', 'h-[var(--bits-select-content-available-height)] w-full')}
		>
			{@render children?.()}
		</SelectPrimitive.Viewport>
		<ScrollDownButton />
	</SelectPrimitive.Content>
</SelectPrimitive.Portal>
