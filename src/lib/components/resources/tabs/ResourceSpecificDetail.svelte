<script lang="ts">
	import AlertDetail from '$lib/components/flux/resources/AlertDetail.svelte';
	import BucketDetail from '$lib/components/flux/resources/BucketDetail.svelte';
	import GitRepositoryDetail from '$lib/components/flux/resources/GitRepositoryDetail.svelte';
	import HelmChartDetail from '$lib/components/flux/resources/HelmChartDetail.svelte';
	import HelmReleaseDetail from '$lib/components/flux/resources/HelmReleaseDetail.svelte';
	import HelmRepositoryDetail from '$lib/components/flux/resources/HelmRepositoryDetail.svelte';
	import KustomizationDetail from '$lib/components/flux/resources/KustomizationDetail.svelte';
	import OCIRepositoryDetail from '$lib/components/flux/resources/OCIRepositoryDetail.svelte';
	import ProviderDetail from '$lib/components/flux/resources/ProviderDetail.svelte';
	import ReceiverDetail from '$lib/components/flux/resources/ReceiverDetail.svelte';
	import type { FluxResource } from '$lib/types/flux';
	import GenericResourceConfiguration from './GenericResourceConfiguration.svelte';

	let {
		resource,
		resourceType
	}: {
		resource: FluxResource;
		resourceType: string;
	} = $props();

	const isGitRepository = $derived(resourceType === 'gitrepositories');
	const isHelmRelease = $derived(resourceType === 'helmreleases');
	const isKustomization = $derived(resourceType === 'kustomizations');
	const isHelmRepository = $derived(resourceType === 'helmrepositories');
	const isHelmChart = $derived(resourceType === 'helmcharts');
	const isBucket = $derived(resourceType === 'buckets');
	const isOCIRepository = $derived(resourceType === 'ocirepositories');
	const isAlert = $derived(resourceType === 'alerts');
	const isProvider = $derived(resourceType === 'providers');
	const isReceiver = $derived(resourceType === 'receivers');
</script>

{#if isGitRepository}
	<GitRepositoryDetail {resource} />
{:else if isHelmRelease}
	<HelmReleaseDetail {resource} />
{:else if isKustomization}
	<KustomizationDetail {resource} />
{:else if isHelmRepository}
	<HelmRepositoryDetail {resource} />
{:else if isHelmChart}
	<HelmChartDetail {resource} />
{:else if isBucket}
	<BucketDetail {resource} />
{:else if isOCIRepository}
	<OCIRepositoryDetail {resource} />
{:else if isAlert}
	<AlertDetail {resource} />
{:else if isProvider}
	<ProviderDetail {resource} />
{:else if isReceiver}
	<ReceiverDetail {resource} />
{:else}
	<GenericResourceConfiguration spec={resource.spec} />
{/if}
