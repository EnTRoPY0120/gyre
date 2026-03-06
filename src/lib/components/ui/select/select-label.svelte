<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { Label as LabelPrimitive } from 'bits-ui';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: LabelPrimitive.RootProps = $props();
</script>

<LabelPrimitive.Root
	bind:ref
	data-slot="select-label"
	class={cn('px-2 py-1.5 text-sm font-semibold', className)}
	{...restProps}
/>
