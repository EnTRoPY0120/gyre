<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { ChevronUp } from 'lucide-svelte';
	import { Select as SelectPrimitive } from 'bits-ui';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: SelectPrimitive.ScrollUpButtonProps = $props();
</script>

<SelectPrimitive.ScrollUpButton
	bind:ref
	data-slot="select-scroll-up-button"
	class={cn('flex cursor-default items-center justify-center py-1', className)}
	{...restProps}
>
	<ChevronUp class="size-4" />
</SelectPrimitive.ScrollUpButton>
