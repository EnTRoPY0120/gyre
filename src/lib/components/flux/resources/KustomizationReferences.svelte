<script lang="ts">
	import DetailSection from '$lib/components/flux/details/DetailSection.svelte';
	import type {
		KustomizationDependency,
		KustomizationHealthCheck
	} from './kustomization-detail-types';

	let {
		dependsOn,
		healthChecks
	}: {
		dependsOn?: KustomizationDependency[];
		healthChecks?: KustomizationHealthCheck[];
	} = $props();
</script>

{#if dependsOn && dependsOn.length > 0}
	<DetailSection title="Dependencies">
		<div class="flex flex-wrap gap-2">
			{#each dependsOn as dep (dep.name)}
				<span
					class="inline-flex items-center gap-1.5 rounded-md bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900/50 dark:text-purple-300"
				>
					<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
						/>
					</svg>
					{dep.name}
					{#if dep.namespace}
						<span class="text-purple-600 dark:text-purple-400">({dep.namespace})</span>
					{/if}
				</span>
			{/each}
		</div>
	</DetailSection>
{/if}

{#if healthChecks && healthChecks.length > 0}
	<DetailSection title="Health Checks">
		<div class="space-y-2">
			{#each healthChecks as check (`${check.kind}-${check.name}-${check.namespace}`)}
				<div class="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700/50">
					<span
						class="inline-flex items-center rounded-md bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-600 dark:text-gray-300"
					>
						{check.kind}
					</span>
					<span class="text-sm text-gray-900 dark:text-gray-100">{check.name}</span>
					<span class="text-sm text-gray-500 dark:text-gray-400">in {check.namespace}</span>
				</div>
			{/each}
		</div>
	</DetailSection>
{/if}
