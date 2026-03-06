<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { Separator as SeparatorPrimitive } from 'bits-ui';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: SeparatorPrimitive.RootProps = $props();
</script>

<SeparatorPrimitive.Root
	bind:ref
	data-slot="select-separator"
	class={cn('-mx-1 my-1 h-px bg-muted', className)}
	{...restProps}
/>
