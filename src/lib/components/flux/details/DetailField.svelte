<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		span?: 1 | 2;
		children: Snippet;
	}

	let { label, span = 1, children }: Props = $props();
</script>

<div class={span === 2 ? 'sm:col-span-2' : ''}>
	<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</dt>
	<dd class="mt-1">
		{@render children()}
	</dd>
</div>
