<script lang="ts">
	import DetailSection from './DetailSection.svelte';

	interface Props {
		ignore: string;
	}

	let { ignore }: Props = $props();
</script>

<DetailSection title="Ignore Patterns">
	<pre
		class="overflow-auto rounded-lg bg-gray-100 p-4 text-sm text-gray-800 dark:bg-gray-900 dark:text-gray-200"><code
			>{ignore}</code
		></pre>
</DetailSection>
