<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		class?: string;
		children: Snippet;
	}

	let { title, class: className = '', children }: Props = $props();
</script>

<div
	class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 {className}"
>
	<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
	{@render children()}
</div>
