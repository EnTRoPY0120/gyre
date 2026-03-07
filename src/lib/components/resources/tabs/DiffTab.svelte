<script lang="ts">
	import ResourceDiffViewer from '$lib/components/flux/ResourceDiffViewer.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import type { ResourceDiff } from '$lib/types/resource';

	interface Props {
		diffs: ResourceDiff[];
		loading: boolean;
		error: string | null;
		timestamp: number | null;
		cached: boolean;
		revision: string | null;
		onRefresh: () => void;
	}

	let { diffs, loading, error, timestamp, cached, revision, onRefresh }: Props = $props();
	function exportDiff() {
		if (diffs.length === 0) return;
		
		const content = diffs.map(d => {
			return `--- ${d.kind}/${d.name} (${d.namespace}) ---\nDesired:\n${d.desired}\n\nLive:\n${d.live || 'None'}\n`;
		}).join('\n');
		
		const blob = new Blob([content], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `drift-${revision?.slice(0, 8) || 'current'}.txt`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}
</script>

<div
	class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
	role="tabpanel"
	aria-labelledby="diff-tab"
>
	<div class="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="flex flex-col gap-1">
			<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Resource Drift</h3>
			{#if timestamp}
				<div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
					<span>
						Last checked: {new Date(timestamp).toLocaleTimeString()}
					</span>
					{#if cached}
						<span
							class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
						>
							<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
								/>
							</svg>
							Cached
						</span>
					{/if}
					{#if revision}
						<span class="font-mono text-[10px]">@ {revision.slice(0, 8)}</span>
					{/if}
				</div>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			{#if diffs.length > 0 && !loading}
				<button
					type="button"
					class="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
					onclick={exportDiff}
					aria-label="Export drift report"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
					</svg>
					Export
				</button>
			{/if}
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
				onclick={onRefresh}
				disabled={loading}
				aria-label="Refresh drift analysis"
			>
				<svg
					class="h-4 w-4 {loading ? 'animate-spin' : ''}"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
					/>
				</svg>
				{loading ? 'Computing...' : 'Refresh'}
			</button>
		</div>
	</div>

	{#if loading && diffs.length === 0}
		<div class="space-y-4">
			{#each Array(3) as _}
				<div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
					<div class="flex items-center justify-between">
						<Skeleton class="h-6 w-1/3" />
						<Skeleton class="h-6 w-24 rounded-full" />
					</div>
					<div class="mt-4 grid grid-cols-2 gap-4">
						<Skeleton class="h-32 w-full" />
						<Skeleton class="h-32 w-full" />
					</div>
				</div>
			{/each}
		</div>
	{:else if error}
		<div
			class="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-900/20"
		>
			<div
				class="mb-2 flex items-center gap-2 text-base font-semibold text-red-700 dark:text-red-400"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				{error.includes('only available when')
					? 'In-Cluster Deployment Required'
					: 'Failed to Calculate Drift'}
			</div>
			<p
				class="text-sm text-red-600 dark:text-red-300"
			>
				{error}
			</p>
			
			<div class="mt-4 flex flex-wrap items-center gap-3">
				<button
					type="button"
					class="inline-flex items-center gap-1.5 rounded-md bg-red-100 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-100 dark:hover:bg-red-800"
					onclick={onRefresh}
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
					</svg>
					Try Again
				</button>
				
				{#if error.includes('only available when')}
					<div
						class="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-900/10"
					>
						<p class="text-xs font-medium text-amber-900 dark:text-amber-200">
							💡 To use drift detection:
						</p>
						<ol
							class="mt-1 ml-4 list-decimal space-y-1 text-xs text-amber-800 dark:text-amber-300"
						>
							<li>Deploy Gyre to your Kubernetes cluster using the Helm chart</li>
							<li>Ensure Gyre runs in the same cluster as your FluxCD installation</li>
						</ol>
					</div>
				{/if}
			</div>
		</div>
	{:else if diffs.length === 0 && !loading}
		<div class="py-12 text-center text-gray-500 dark:text-gray-400">
			No resources found in this Kustomization to compare.
		</div>
	{:else}
		<ResourceDiffViewer {diffs} />
	{/if}
</div>
