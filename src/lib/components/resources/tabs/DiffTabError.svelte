<script lang="ts">
	let {
		error,
		onRefresh
	}: {
		error: { code?: string; message: string };
		onRefresh: () => void;
	} = $props();
</script>

<div class="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-900/20">
	<div class="mb-2 flex items-center gap-2 text-base font-semibold text-red-700 dark:text-red-400">
		<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
			/>
		</svg>
		{error.code === 'IN_CLUSTER_REQUIRED'
			? 'In-Cluster Deployment Required'
			: 'Failed to Calculate Drift'}
	</div>
	<p class="text-sm text-red-600 dark:text-red-300">{error.message}</p>

	<div class="mt-4 flex flex-wrap items-center gap-3">
		<button
			type="button"
			class="inline-flex items-center gap-1.5 rounded-md bg-red-100 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-100 dark:hover:bg-red-800"
			onclick={onRefresh}
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
				/>
			</svg>
			Try Again
		</button>

		{#if error.code === 'IN_CLUSTER_REQUIRED'}
			<div class="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-900/10">
				<p class="text-xs font-medium text-amber-900 dark:text-amber-200">💡 To use drift detection:</p>
				<ol class="mt-1 ml-4 list-decimal space-y-1 text-xs text-amber-800 dark:text-amber-300">
					<li>Deploy Gyre to your Kubernetes cluster using the Helm chart</li>
					<li>Ensure Gyre runs in the same cluster as your FluxCD installation</li>
				</ol>
			</div>
		{/if}
	</div>
</div>
