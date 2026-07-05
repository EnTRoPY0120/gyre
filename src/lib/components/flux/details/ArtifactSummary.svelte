<script lang="ts">
	import { formatTimestamp } from '$lib/utils/flux';
	import DetailField from './DetailField.svelte';
	import DetailGrid from './DetailGrid.svelte';
	import DetailSection from './DetailSection.svelte';

	interface Artifact {
		path?: string;
		url?: string;
		revision?: string;
		lastUpdateTime?: string;
	}

	interface Props {
		artifact: Artifact;
		showPath?: boolean;
		observedChartName?: string;
	}

	let { artifact, showPath = false, observedChartName }: Props = $props();
</script>

<DetailSection title="Latest Artifact">
	<DetailGrid>
		{#if artifact.revision}
			<DetailField label="Revision" span={2}>
				<span class="font-mono text-sm text-gray-900 dark:text-gray-100">{artifact.revision}</span>
			</DetailField>
		{/if}

		{#if observedChartName}
			<DetailField label="Observed Chart Name">
				<span class="text-sm text-gray-900 dark:text-gray-100">{observedChartName}</span>
			</DetailField>
		{/if}

		{#if artifact.lastUpdateTime}
			<DetailField label="Last Updated">
				<span class="text-sm text-gray-900 dark:text-gray-100">
					{formatTimestamp(artifact.lastUpdateTime)}
				</span>
			</DetailField>
		{/if}

		{#if showPath && artifact.path}
			<DetailField label="Path">
				<span class="font-mono text-sm text-gray-900 dark:text-gray-100">{artifact.path}</span>
			</DetailField>
		{/if}
	</DetailGrid>
</DetailSection>
