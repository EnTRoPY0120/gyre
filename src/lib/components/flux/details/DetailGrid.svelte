<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<dl class="grid gap-4 sm:grid-cols-2">
	{@render children()}
</dl>
