<script lang="ts">
	import { Command as CommandPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils';

	let { ref = $bindable(null), class: className, ...restProps }: CommandPrimitive.RootProps = $props();
</script>

<CommandPrimitive.Root
	bind:ref
	class={cn(
		'flex h-full w-full flex-col overflow-hidden rounded-md bg-zinc-900 text-zinc-50',
		className
	)}
	{...restProps}
/>
