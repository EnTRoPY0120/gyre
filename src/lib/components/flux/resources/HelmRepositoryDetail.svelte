<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';
	import ArtifactSummary from '$lib/components/flux/details/ArtifactSummary.svelte';
	import { isSafeExternalUrl } from '$lib/utils/url';
	import HelmRepositoryAuthentication from './HelmRepositoryAuthentication.svelte';
	import HelmRepositoryConfiguration from './HelmRepositoryConfiguration.svelte';
	import type {
		HelmRepositoryArtifact,
		HelmRepositorySecretRef
	} from './helm-repository-detail-types';

	interface Props {
		resource: FluxResource;
	}

	let { resource }: Props = $props();

	const spec = $derived(resource.spec || {});
	const status = $derived(resource.status || {});

	const url = $derived(spec.url as string | undefined);
	const isSafeUrl = $derived(isSafeExternalUrl(url));
	const type = $derived((spec.type as string | undefined) || 'default');
	const interval = $derived(spec.interval as string | undefined);
	const timeout = $derived(spec.timeout as string | undefined);
	const secretRef = $derived(spec.secretRef as HelmRepositorySecretRef | undefined);
	const passCredentials = $derived(spec.passCredentials as boolean | undefined);
	const suspend = $derived(spec.suspend as boolean | undefined);
	const provider = $derived(spec.provider as string | undefined);
	const certSecretRef = $derived(spec.certSecretRef as HelmRepositorySecretRef | undefined);
	const artifact = $derived(status.artifact as HelmRepositoryArtifact | undefined);
</script>

<div class="space-y-6">
	<HelmRepositoryConfiguration
		{url}
		{isSafeUrl}
		{type}
		{interval}
		{timeout}
		{provider}
		{suspend}
	/>
	<HelmRepositoryAuthentication {secretRef} {certSecretRef} {passCredentials} />
	{#if artifact}
		<ArtifactSummary {artifact} showPath />
	{/if}
</div>
