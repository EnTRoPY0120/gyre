<script lang="ts">
	import DetailSection from '$lib/components/flux/details/DetailSection.svelte';
	import type { KustomizationPostBuild } from './kustomization-detail-types';

	let {
		patches,
		postBuild
	}: {
		patches?: unknown[];
		postBuild?: KustomizationPostBuild;
	} = $props();
</script>

{#if patches && patches.length > 0}
	<DetailSection title="Patches">
		<p class="text-sm text-gray-600 dark:text-gray-400">
			<span class="font-medium text-gray-900 dark:text-gray-100">{patches.length}</span> patch(es)
			configured
		</p>
	</DetailSection>
{/if}

{#if postBuild?.substitute && Object.keys(postBuild.substitute).length > 0}
	<DetailSection title="PostBuild Substitutions">
		<div class="flex flex-wrap gap-2">
			{#each Object.entries(postBuild.substitute) as [key, value] (key)}
				<span
					class="inline-flex items-center rounded-md bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800 dark:bg-orange-900/50 dark:text-orange-300"
				>
					<span class="font-semibold">{key}</span>=<span class="text-orange-600 dark:text-orange-400"
						>{value}</span
					>
				</span>
			{/each}
		</div>
	</DetailSection>
{/if}
