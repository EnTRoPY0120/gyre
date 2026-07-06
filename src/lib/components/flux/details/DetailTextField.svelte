<script lang="ts">
	import DetailField from './DetailField.svelte';

	interface Props {
		label: string;
		value: string;
		span?: 1 | 2;
	}

	let { label, value, span = 1 }: Props = $props();
</script>

<DetailField {label} {span}>
	<span class="text-sm text-gray-900 dark:text-gray-100">{value}</span>
</DetailField>
