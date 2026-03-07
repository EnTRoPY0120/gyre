<script lang="ts">
	import { clsx, type ClassValue } from 'clsx';
	import { twMerge } from 'tailwind-merge';

	function cn(...inputs: ClassValue[]) {
		return twMerge(clsx(inputs));
	}

	let { class: className, ...props } = $props<{ class?: string }>();
</script>

<div class={cn('animate-pulse rounded-md bg-muted dark:bg-gray-700', className)} {...props}></div>
