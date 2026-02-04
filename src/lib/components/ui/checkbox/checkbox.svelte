<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	type Props = HTMLInputAttributes & {
		checked?: boolean;
	};

	let { class: className, checked = $bindable(false), ...rest }: Props = $props();
</script>

<div class="flex items-center">
	<input
		type="checkbox"
		bind:checked
		class={cn(
			'peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background checked:bg-primary checked:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
			className
		)}
		{...rest}
	/>
</div>
