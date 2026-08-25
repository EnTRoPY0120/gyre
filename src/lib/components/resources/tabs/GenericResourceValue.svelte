<script lang="ts">
	let { value }: { value: unknown } = $props();
</script>

{#if typeof value === 'object'}
	<code class="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-700">{JSON.stringify(value)}</code>
{:else if typeof value === 'boolean'}
	<span
		class="inline-flex rounded-md px-2 py-0.5 text-xs font-medium {value
			? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
			: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}"
	>
		{value ? 'Yes' : 'No'}
	</span>
{:else}
	{value}
{/if}
