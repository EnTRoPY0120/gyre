<script lang="ts">
	import Pagination from '$lib/components/ui/pagination/Pagination.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import ClusterCard from './ClusterCard.svelte';
	import type { ClusterSummary } from './cluster-types';

	let {
		clusters,
		total,
		limit,
		offset,
		onPageChange,
		onAdd,
		onDelete,
		onHealthCheck
	}: {
		clusters: ClusterSummary[];
		total: number;
		limit: number;
		offset: number;
		onPageChange: (offset: number) => void;
		onAdd: () => void;
		onDelete: (cluster: ClusterSummary) => void;
		onHealthCheck: (clusterId?: string) => void;
	} = $props();
</script>

{#if clusters.length > 0}
	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
		{#each clusters as cluster (cluster.id)}
			<ClusterCard {cluster} onDelete={onDelete} onHealthCheck={onHealthCheck} />
		{/each}
	</div>

	<Pagination {total} {limit} {offset} onPageChange={onPageChange} />
{:else}
	<div class="rounded-xl border border-slate-700/50 bg-slate-800/50 p-12 text-center">
		<div class="mb-4 flex justify-center">
			<div class="flex h-16 w-16 items-center justify-center rounded-full bg-slate-700">
				<svg class="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
					/>
				</svg>
			</div>
		</div>
		<h3 class="mb-2 text-lg font-medium text-white">No clusters configured</h3>
		<p class="mb-6 text-slate-400">Add your first Kubernetes cluster by uploading a kubeconfig</p>
		<Button onclick={onAdd}>Add Cluster</Button>
	</div>
{/if}
