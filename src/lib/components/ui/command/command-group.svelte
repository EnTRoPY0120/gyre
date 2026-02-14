<script lang="ts">
	import { Command as CommandPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: CommandPrimitive.GroupProps = $props();
</script>

<CommandPrimitive.Group
	bind:ref
	class={cn(
		'overflow-hidden p-1 text-zinc-50 [&_[data-command-group-heading]]:px-2 [&_[data-command-group-heading]]:py-1.5 [&_[data-command-group-heading]]:text-xs [&_[data-command-group-heading]]:font-medium [&_[data-command-group-heading]]:text-zinc-400',
		className
	)}
	{...restProps}
/>
