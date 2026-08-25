<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';
	import ArtifactSummary from '$lib/components/flux/details/ArtifactSummary.svelte';
	import IgnorePatternsPanel from '$lib/components/flux/details/IgnorePatternsPanel.svelte';
	import BucketProviderSettings from './BucketProviderSettings.svelte';
	import BucketSyncSettings from './BucketSyncSettings.svelte';

	interface Props {
		resource: FluxResource;
	}

	let { resource }: Props = $props();

	const spec = $derived(resource.spec || {});
	const status = $derived(resource.status || {});
	const ignore = $derived(spec.ignore as string | undefined);

	const artifact = $derived(
		status.artifact as
			| {
					path?: string;
					url?: string;
					revision?: string;
					lastUpdateTime?: string;
			  }
			| undefined
	);
</script>

<div class="space-y-6">
	<!-- Bucket Configuration -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
			Bucket Configuration
		</h3>
		<dl class="grid gap-4 sm:grid-cols-2">
			<BucketProviderSettings {resource} />
			<BucketSyncSettings {resource} />
		</dl>
	</div>

	<!-- Latest Artifact -->
	{#if artifact}
		<ArtifactSummary {artifact} />
	{/if}

	<!-- Ignore Patterns -->
	{#if ignore}
		<IgnorePatternsPanel {ignore} />
	{/if}
</div>
