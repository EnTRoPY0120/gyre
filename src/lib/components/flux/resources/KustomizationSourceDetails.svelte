<script lang="ts">
	import DetailField from '$lib/components/flux/details/DetailField.svelte';
	import DetailGrid from '$lib/components/flux/details/DetailGrid.svelte';
	import DetailSection from '$lib/components/flux/details/DetailSection.svelte';
	import DetailTextField from '$lib/components/flux/details/DetailTextField.svelte';
	import type { KustomizationSourceRef } from './kustomization-detail-types';

	let {
		sourceRef,
		path,
		interval,
		timeout,
		targetNamespace
	}: {
		sourceRef?: KustomizationSourceRef;
		path?: string;
		interval?: string;
		timeout?: string;
		targetNamespace?: string;
	} = $props();
</script>

<DetailSection title="Source Configuration">
	<DetailGrid>
		{#if sourceRef}
			<DetailField label="Source Reference">
				<span
					class="inline-flex items-center gap-1.5 rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
				>
					<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
						/>
					</svg>
					{sourceRef.kind}
				</span>
				<span class="ml-2 text-sm text-gray-900 dark:text-gray-100">
					{sourceRef.name}
					{#if sourceRef.namespace}
						<span class="text-gray-500 dark:text-gray-400">({sourceRef.namespace})</span>
					{/if}
				</span>
			</DetailField>
		{/if}

		{#if path}
			<DetailField label="Path">
				<code
					class="rounded bg-gray-100 px-2 py-1 text-sm text-gray-800 dark:bg-gray-700 dark:text-gray-200"
					>{path}</code
				>
			</DetailField>
		{/if}

		{#if interval}
			<DetailTextField label="Reconcile Interval" value={interval} />
		{/if}

		{#if timeout}
			<DetailTextField label="Timeout" value={timeout} />
		{/if}

		{#if targetNamespace}
			<DetailField label="Target Namespace">
				<span
					class="inline-flex items-center rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/50 dark:text-green-300"
				>
					{targetNamespace}
				</span>
			</DetailField>
		{/if}
	</DetailGrid>
</DetailSection>
