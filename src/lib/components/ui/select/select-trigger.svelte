<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { ChevronDown } from 'lucide-svelte';
	import { Select as SelectPrimitive } from 'bits-ui';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: SelectPrimitive.TriggerProps = $props();
</script>

<SelectPrimitive.Trigger
	bind:ref
	data-slot="select-trigger"
	class={cn(
		'flex h-9 w-full items-center justify-between whitespace-nowrap rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs ring-offset-background placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none data-[state=open]:border-primary data-[state=open]:ring-1 data-[state=open]:ring-primary disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
		className
	)}
	{...restProps}
>
	{@render children?.()}
	<ChevronDown class="size-4 opacity-50" />
</SelectPrimitive.Trigger>
