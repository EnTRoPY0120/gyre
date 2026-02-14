<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: DialogPrimitive.ContentProps = $props();
</script>

<DialogPrimitive.Portal>
	<DialogPrimitive.Overlay class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
	<DialogPrimitive.Content
		bind:ref
		class={cn(
			'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border border-zinc-800 bg-zinc-900 p-6 shadow-lg sm:rounded-lg',
			className
		)}
		{...restProps}
	>
		{@render children?.()}
	</DialogPrimitive.Content>
</DialogPrimitive.Portal>
