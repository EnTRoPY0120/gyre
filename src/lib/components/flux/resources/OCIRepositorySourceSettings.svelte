<script lang="ts">
	import DetailField from '$lib/components/flux/details/DetailField.svelte';
	import DetailTextField from '$lib/components/flux/details/DetailTextField.svelte';
	import SuspendedBadge from '$lib/components/flux/details/SuspendedBadge.svelte';

	let {
		interval,
		timeout,
		suspend
	}: {
		interval: string | undefined;
		timeout: string | undefined;
		suspend: boolean | undefined;
	} = $props();
</script>

{#if interval}
	<DetailTextField label="Sync Interval" value={interval} />
{/if}

{#if timeout}
	<DetailTextField label="Timeout" value={timeout} />
{/if}

{#if suspend !== undefined}
	<DetailField label="Suspended">
		<SuspendedBadge suspended={suspend} />
	</DetailField>
{/if}
