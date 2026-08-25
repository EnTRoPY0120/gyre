<script lang="ts">
	import ConditionList from '$lib/components/flux/ConditionList.svelte';
	import ResourceMetadata from '$lib/components/flux/ResourceMetadata.svelte';
	import type { FluxResource, K8sCondition } from '$lib/types/flux';
	import ResourceSpecificDetail from './ResourceSpecificDetail.svelte';

	interface Props {
		resource: FluxResource;
		resourceType: string;
		conditions: K8sCondition[];
	}

	let { resource, resourceType, conditions }: Props = $props();
</script>

<div class="grid gap-6 lg:grid-cols-3">
	<!-- Main Column -->
	<div class="space-y-6 lg:col-span-2">
		<!-- Resource-Specific Details -->
		<ResourceSpecificDetail {resource} {resourceType} />

		<!-- Conditions Card -->
		<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
			<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Conditions</h3>
			<ConditionList {conditions} />
		</div>
	</div>

	<!-- Sidebar Column -->
	<div class="space-y-6 lg:col-span-1">
		<!-- Metadata Card -->
		<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
			<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Metadata</h3>
			<ResourceMetadata metadata={resource.metadata} />
		</div>
	</div>
</div>
