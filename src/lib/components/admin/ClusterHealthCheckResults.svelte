<script lang="ts">
	import type { ClusterHealthCheck } from '$lib/server/clusters';

	let {
		checks,
		kubernetesVersion
	}: {
		checks: ClusterHealthCheck['checks'];
		kubernetesVersion?: string;
	} = $props();
</script>

<div class="space-y-3">
	{#each checks as check (check.name)}
		<div
			class="rounded-lg border {check.passed ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'} p-4"
		>
			<div class="flex items-start gap-3">
				<div class="mt-0.5 flex-shrink-0">
					{#if check.passed}
						<svg class="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 13l4 4L19 7"
							/>
						</svg>
					{:else}
						<svg class="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					{/if}
				</div>
				<div class="min-w-0 flex-1">
					<div class="flex items-center justify-between">
						<h3 class="font-medium {check.passed ? 'text-emerald-400' : 'text-red-400'}">
							{check.name}
						</h3>
						{#if check.duration}
							<span class="text-xs text-slate-500">{check.duration}ms</span>
						{/if}
					</div>
					<p class="mt-1 text-sm text-slate-300">{check.message}</p>
					{#if check.details}
						<p class="mt-2 rounded bg-slate-900/50 p-2 text-xs text-slate-400">{check.details}</p>
					{/if}
				</div>
			</div>
		</div>
	{/each}
</div>

{#if kubernetesVersion}
	<div class="mt-4 border-t border-slate-700/50 pt-4">
		<p class="text-sm text-slate-400">
			<span class="font-medium">Kubernetes Version:</span>
			{kubernetesVersion}
		</p>
	</div>
{/if}
