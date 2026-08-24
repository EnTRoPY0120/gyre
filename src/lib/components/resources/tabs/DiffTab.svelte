<script lang="ts">
	import ResourceDiffViewer from '$lib/components/flux/ResourceDiffViewer.svelte';
	import type { ResourceDiff } from '$lib/types/resource';
	import DiffTabError from './DiffTabError.svelte';
	import DiffTabHeader from './DiffTabHeader.svelte';
	import DiffTabLoading from './DiffTabLoading.svelte';

	export interface DiffError {
		code?: string;
		message: string;
	}

	interface Props {
		diffs: ResourceDiff[];
		loading: boolean;
		error: DiffError | null;
		timestamp: number | null;
		cached: boolean;
		revision: string | null;
		onRefresh: () => void;
	}

	let { diffs, loading, error, timestamp, cached, revision, onRefresh }: Props = $props();

	function exportDiff() {
		if (diffs.length === 0) return;

		const content = diffs
			.map(
				(diff) =>
					`--- ${diff.kind}/${diff.name} (${diff.namespace}) ---\nDesired:\n${diff.desired}\n\nLive:\n${diff.live || 'None'}\n`
			)
			.join('\n');

		const blob = new Blob([content], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = `drift-${revision?.slice(0, 8) || 'current'}.txt`;
		document.body.appendChild(anchor);
		anchor.click();
		document.body.removeChild(anchor);
		URL.revokeObjectURL(url);
	}
</script>

<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
	<DiffTabHeader
		diffsCount={diffs.length}
		{loading}
		{timestamp}
		{cached}
		{revision}
		onExport={exportDiff}
		{onRefresh}
	/>

	{#if loading && diffs.length === 0}
		<DiffTabLoading />
	{:else if error}
		<DiffTabError {error} {onRefresh} />
	{:else if diffs.length === 0 && !loading}
		<div class="py-12 text-center text-gray-500 dark:text-gray-400">
			No resources found in this Kustomization to compare.
		</div>
	{:else}
		<ResourceDiffViewer {diffs} />
	{/if}
</div>
