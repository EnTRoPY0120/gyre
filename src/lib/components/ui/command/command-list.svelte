<script lang="ts">
	import { Command as CommandPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils';

	let { ref = $bindable(null), class: className, ...restProps }: CommandPrimitive.ListProps = $props();
</script>

<CommandPrimitive.List
	bind:ref
	class={cn('max-h-[400px] overflow-y-auto overflow-x-hidden', className)}
	{...restProps}
/>
