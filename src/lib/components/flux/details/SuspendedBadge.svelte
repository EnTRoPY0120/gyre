<script lang="ts">
	import StatusBadge from './StatusBadge.svelte';

	interface Props {
		suspended: boolean;
	}

	let { suspended }: Props = $props();
</script>

<StatusBadge label={suspended ? 'Yes' : 'No'} tone={suspended ? 'gray' : 'green'} />
