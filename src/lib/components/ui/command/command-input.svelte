<script lang="ts">
	import { Command as CommandPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils';
	import Icon from '$lib/components/ui/Icon.svelte';

	let {
		ref = $bindable(null),
		value = $bindable(''),
		class: className,
		...restProps
	}: CommandPrimitive.InputProps & { value?: string } = $props();
</script>

<div class="flex items-center border-b border-zinc-800 px-3" data-command-input-wrapper="">
	<Icon name="search" size={18} class="mr-2 shrink-0 opacity-50" />
	<CommandPrimitive.Input
		bind:ref
		bind:value
		class={cn(
			'flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50',
			className
		)}
		{...restProps}
	/>
</div>
