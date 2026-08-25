<script lang="ts">
	import DetailField from '$lib/components/flux/details/DetailField.svelte';
	import SecretRefBadge from '$lib/components/flux/details/SecretRefBadge.svelte';
	import SuspendedBadge from '$lib/components/flux/details/SuspendedBadge.svelte';
	import type { FluxResource } from '$lib/types/flux';

	interface Props {
		resource: FluxResource;
	}

	let { resource }: Props = $props();

	const spec = $derived(resource.spec || {});
	const interval = $derived(spec.interval as string | undefined);
	const timeout = $derived(spec.timeout as string | undefined);
	const secretRef = $derived(spec.secretRef as { name: string } | undefined);
	const suspend = $derived(spec.suspend as boolean | undefined);
</script>

{#if interval}
	<DetailField label="Sync Interval">
		<span class="text-sm text-gray-900 dark:text-gray-100">{interval}</span>
	</DetailField>
{/if}

{#if timeout}
	<DetailField label="Timeout">
		<span class="text-sm text-gray-900 dark:text-gray-100">{timeout}</span>
	</DetailField>
{/if}

{#if secretRef}
	<DetailField label="Authentication Secret">
		<SecretRefBadge name={secretRef.name} />
	</DetailField>
{/if}

{#if suspend !== undefined}
	<DetailField label="Suspended">
		<SuspendedBadge suspended={suspend} />
	</DetailField>
{/if}
