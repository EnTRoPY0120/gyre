<script lang="ts">
	import ResourceMetadata from '$lib/components/flux/ResourceMetadata.svelte';
	import ConditionList from '$lib/components/flux/ConditionList.svelte';
	import GitRepositoryDetail from '$lib/components/flux/resources/GitRepositoryDetail.svelte';
	import HelmReleaseDetail from '$lib/components/flux/resources/HelmReleaseDetail.svelte';
	import KustomizationDetail from '$lib/components/flux/resources/KustomizationDetail.svelte';
	import HelmRepositoryDetail from '$lib/components/flux/resources/HelmRepositoryDetail.svelte';
	import HelmChartDetail from '$lib/components/flux/resources/HelmChartDetail.svelte';
	import BucketDetail from '$lib/components/flux/resources/BucketDetail.svelte';
	import OCIRepositoryDetail from '$lib/components/flux/resources/OCIRepositoryDetail.svelte';
	import AlertDetail from '$lib/components/flux/resources/AlertDetail.svelte';
	import ProviderDetail from '$lib/components/flux/resources/ProviderDetail.svelte';
	import ReceiverDetail from '$lib/components/flux/resources/ReceiverDetail.svelte';
	import type { FluxResource, K8sCondition } from '$lib/types/flux';

	interface Props {
		resource: FluxResource;
		resourceType: string;
		conditions: K8sCondition[];
	}

	let { resource, resourceType, conditions }: Props = $props();

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

<div class="grid gap-6 lg:grid-cols-3">
	<!-- Main Column -->
	<div class="space-y-6 lg:col-span-2">
		<!-- Resource-Specific Details -->
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
		{:else if resource.spec}
			<!-- Generic Configuration Card for unknown resource types -->
			<div
				class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
			>
				<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Configuration</h3>
				<dl class="grid gap-4 sm:grid-cols-2">
					{#each Object.entries(resource.spec).slice(0, 9) as [key, value], index (index)}
						<div>
							<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">{key}</dt>
							<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
								{#if typeof value === 'object'}
									<code class="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-700"
										>{JSON.stringify(value)}</code
									>
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
							</dd>
						</div>
					{/each}
				</dl>
			</div>
		{/if}

		<!-- Conditions Card -->
		<div
			class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
		>
			<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Conditions</h3>
			<ConditionList {conditions} />
		</div>
	</div>

	<!-- Sidebar Column -->
	<div class="space-y-6 lg:col-span-1">
		<!-- Metadata Card -->
		<div
			class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
		>
			<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Metadata</h3>
			<ResourceMetadata metadata={resource.metadata} />
		</div>
	</div>
</div>
