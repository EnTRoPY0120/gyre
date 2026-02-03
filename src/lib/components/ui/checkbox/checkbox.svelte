<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';
	import { Check } from 'lucide-svelte';

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
            "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 checked:bg-primary checked:text-primary-foreground",
            className
        )}
        {...rest}
    />
</div>
