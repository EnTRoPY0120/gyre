<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Button from '$lib/components/ui/button/button.svelte';
	import { getCsrfToken } from '$lib/utils/csrf';
	import type { ClusterSummary } from './cluster-types';

	let {
		cluster,
		onDelete,
		onHealthCheck
	}: {
		cluster: ClusterSummary;
		onDelete: (cluster: ClusterSummary) => void;
		onHealthCheck: (clusterId: string) => void;
	} = $props();

	function formatDate(date: Date | null) {
		if (!date) return 'Never';
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function handleTestResult(result: { type: string }) {
		if (result.type === 'success' || result.type === 'failure') {
			setTimeout(() => onHealthCheck(cluster.id), 100);
		}
	}
</script>

<div class="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
	<div class="mb-3 flex items-start justify-between">
		<div>
			<div class="flex items-center gap-2">
				<h3 class="font-semibold text-white">{cluster.name}</h3>
				{#if !cluster.isLocal}
					<span class="rounded bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400">In-Cluster</span>
				{/if}
			</div>
			{#if cluster.description}
				<p class="text-sm text-slate-400">{cluster.description}</p>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			<span class="flex h-2 w-2 rounded-full {cluster.isActive ? 'bg-emerald-400' : 'bg-slate-400'}"></span>
		</div>
	</div>

	<div class="mb-3 space-y-1 text-sm">
		<div class="flex justify-between text-slate-400">
			<span>Contexts:</span>
			<span class="text-white">{cluster.contextCount}</span>
		</div>
		<div class="flex justify-between text-slate-400">
			<span>Last Connected:</span>
			<span class="text-white">{formatDate(cluster.lastConnectedAt)}</span>
		</div>
		{#if cluster.lastError}
			<div class="mt-2 rounded bg-red-500/10 p-2 text-xs text-red-400">{cluster.lastError}</div>
		{/if}
	</div>

	<div class="flex justify-between gap-2 border-t border-slate-700/50 pt-3">
		<div class="flex gap-2">
			<form
				method="POST"
				action="?/test"
				use:enhance={() => async ({ result, update }) => {
					await update();
					if (result.type === 'success') await invalidateAll();
					handleTestResult(result);
				}}
				class="inline"
			>
				<input type="hidden" name="_csrf" value={getCsrfToken()} />
				<input type="hidden" name="clusterId" value={cluster.id} />
				<Button type="submit" variant="ghost" size="sm" title="Test Connection">
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
					</svg>
				</Button>
			</form>
			<form
				method="POST"
				action="?/toggle"
				use:enhance={() => async ({ result }) => {
					if (result.type === 'success') await invalidateAll();
				}}
				class="inline"
			>
				<input type="hidden" name="_csrf" value={getCsrfToken()} />
				<input type="hidden" name="clusterId" value={cluster.id} />
				<input type="hidden" name="isActive" value={(!cluster.isActive).toString()} />
				<Button type="submit" variant="ghost" size="sm" title={cluster.isActive ? 'Disable' : 'Enable'}>
					{#if cluster.isActive}
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0z" />
						</svg>
					{:else}
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0z" />
						</svg>
					{/if}
				</Button>
			</form>
		</div>
		<Button
			variant="ghost"
			size="sm"
			onclick={() => onDelete(cluster)}
			class="text-red-400 hover:text-red-300"
			title="Delete"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
			</svg>
		</Button>
	</div>
</div>
