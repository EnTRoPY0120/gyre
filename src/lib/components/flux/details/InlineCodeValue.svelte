<script lang="ts">
	interface Props {
		value: string;
	}

	let { value }: Props = $props();
</script>

<code class="rounded bg-gray-100 px-2 py-1 text-sm text-gray-800 dark:bg-gray-700 dark:text-gray-200"
	>{value}</code
>
