<script lang="ts">
	import ActionButtons from '$lib/components/flux/ActionButtons.svelte';
	import StatusBadge from '$lib/components/flux/StatusBadge.svelte';
	import Breadcrumbs from '$lib/components/common/Breadcrumbs.svelte';
	import type { FluxResource } from '$lib/types/flux';

	let {
		resource,
		resourceType,
		namespace,
		name,
		onCopyName,
		onViewInKubectl
	}: {
		resource: FluxResource;
		resourceType: string;
		namespace: string;
		name: string;
		onCopyName: () => void;
		onViewInKubectl: () => void;
	} = $props();
</script>

<div class="space-y-4">
	<Breadcrumbs {resourceType} {namespace} {name} />

	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="flex-1">
			<div class="flex items-center gap-3">
				<h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">{name}</h1>
				<button
					type="button"
					class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
					onclick={onCopyName}
					aria-label="Copy resource name"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8z"
						/>
					</svg>
				</button>
				<StatusBadge
					conditions={resource.status?.conditions}
					suspended={resource.spec?.suspend as boolean | undefined}
					observedGeneration={resource.status?.observedGeneration}
					generation={resource.metadata?.generation}
				/>
			</div>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
				{resourceType} in <span class="font-medium text-gray-700 dark:text-gray-300">{namespace}</span>
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
				onclick={onViewInKubectl}
				aria-label="View in Kubernetes (copy kubectl command)"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
					/>
				</svg>
				Kubectl
			</button>
			<ActionButtons {resource} type={resourceType} {namespace} {name} />
		</div>
	</div>
</div>
