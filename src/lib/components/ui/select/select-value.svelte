<script lang="ts">
	import type { Snippet } from 'svelte';

	let { placeholder = '', children }: { placeholder?: string; children?: Snippet } = $props();
</script>

{#if children}
	{@render children()}
{:else}
	{placeholder}
{/if}
