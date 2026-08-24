<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';
	import ArtifactSummary from '$lib/components/flux/details/ArtifactSummary.svelte';
	import IgnorePatternsPanel from '$lib/components/flux/details/IgnorePatternsPanel.svelte';
	import OCIAuthentication from './OCIAuthentication.svelte';
	import OCILayerSelector from './OCILayerSelector.svelte';
	import OCIRepositorySourceFields from './OCIRepositorySourceFields.svelte';
	import OCIRepositorySourceSettings from './OCIRepositorySourceSettings.svelte';
	import type {
		OCIRepositoryArtifact,
		OCILayerSelector as OCILayerSelectorData,
		OCIRepositoryRef,
		OCIRepositorySecretRef
	} from './oci-repository-detail-types';

	interface Props {
		resource: FluxResource;
	}

	let { resource }: Props = $props();

	const spec = $derived(resource.spec || {});
	const status = $derived(resource.status || {});

	const url = $derived(spec.url as string | undefined);
	const interval = $derived(spec.interval as string | undefined);
	const timeout = $derived(spec.timeout as string | undefined);
	const ref = $derived(spec.ref as OCIRepositoryRef | undefined);
	const provider = $derived(spec.provider as string | undefined);
	const secretRef = $derived(spec.secretRef as OCIRepositorySecretRef | undefined);
	const certSecretRef = $derived(spec.certSecretRef as OCIRepositorySecretRef | undefined);
	const serviceAccountName = $derived(spec.serviceAccountName as string | undefined);
	const insecure = $derived(spec.insecure as boolean | undefined);
	const suspend = $derived(spec.suspend as boolean | undefined);
	const ignore = $derived(spec.ignore as string | undefined);
	const layerSelector = $derived(spec.layerSelector as OCILayerSelectorData | undefined);
	const artifact = $derived(status.artifact as OCIRepositoryArtifact | undefined);
</script>

<div class="space-y-6">
	<!-- OCI Source Configuration -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
			OCI Source Configuration
		</h3>
		<dl class="grid gap-4 sm:grid-cols-2">
			<OCIRepositorySourceFields {url} {insecure} {ref} {provider} />
			<OCIRepositorySourceSettings {interval} {timeout} {suspend} />
		</dl>
	</div>

	{#if layerSelector}
		<OCILayerSelector {layerSelector} />
	{/if}

	<OCIAuthentication {secretRef} {certSecretRef} {serviceAccountName} />

	{#if artifact}
		<ArtifactSummary {artifact} />
	{/if}

	{#if ignore}
		<IgnorePatternsPanel {ignore} />
	{/if}
</div>
