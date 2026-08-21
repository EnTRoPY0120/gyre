<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Button from '$lib/components/ui/button/button.svelte';
	import { getCsrfToken } from '$lib/utils/csrf';
	import type { ClusterRecoverySummary, ClusterRecoverySummaryAction } from '$lib/clusters/recovery';
	import type { ClusterHealthCheck } from '$lib/server/clusters';

	let {
		healthCheck,
		recoverySummary,
		healthCheckErrorSummary,
		activeClusterId,
		onClose,
		onRecoveryAction
	}: {
		healthCheck: ClusterHealthCheck;
		recoverySummary: ClusterRecoverySummary | null;
		healthCheckErrorSummary: string | null;
		activeClusterId: string | null;
		onClose: () => void;
		onRecoveryAction: (action: Extract<ClusterRecoverySummaryAction, { action: string }>['action']) => void;
	} = $props();
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
	<div
		class="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-2xl"
	>
		<div class="mb-4 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div
					class="flex h-12 w-12 items-center justify-center rounded-full {healthCheck.connected
						? 'bg-emerald-500/20'
						: 'bg-red-500/20'}"
				>
					{#if healthCheck.connected}
						<svg class="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 13l4 4L19 7"
							/>
						</svg>
					{:else}
						<svg class="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					{/if}
				</div>
				<div>
					<h2 class="text-xl font-bold text-white">Connection Diagnostics</h2>
					<p class="text-sm text-slate-400">{healthCheck.clusterName}</p>
				</div>
			</div>
			<button onclick={onClose} class="text-slate-400 hover:text-white" aria-label="Close">
				<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>
		</div>

		{#if recoverySummary}
			<div class="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
				<div class="flex flex-col gap-4">
					<div>
						<p class="text-sm font-semibold text-red-300">{recoverySummary.title}</p>
						<p class="mt-1 text-sm text-slate-200">{recoverySummary.description}</p>
						{#if healthCheckErrorSummary}
							<p class="mt-3 rounded-lg bg-slate-900/50 p-3 text-xs text-slate-300">
								{healthCheckErrorSummary}
							</p>
						{/if}
					</div>
					<div class="space-y-2">
						{#each recoverySummary.guidance as item, idx (idx)}
							<p class="text-sm text-slate-300">• {item}</p>
						{/each}
					</div>
					<div class="flex flex-wrap gap-2">
						{#each recoverySummary.actions as action (action.label)}
							{#if 'href' in action}
								<a
									href={action.href}
									class="inline-flex items-center rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
								>
									{action.label}
								</a>
							{:else if 'action' in action}
								<Button
									type="button"
									variant={action.action === 'retest' ? 'default' : 'outline'}
									onclick={() => onRecoveryAction(action.action)}
								>
									{action.label}
								</Button>
							{/if}
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<div class="space-y-3">
			{#each healthCheck.checks as check (check.name)}
				<div
					class="rounded-lg border {check.passed
						? 'border-emerald-500/30 bg-emerald-500/5'
						: 'border-red-500/30 bg-red-500/5'} p-4"
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

		{#if healthCheck.kubernetesVersion}
			<div class="mt-4 border-t border-slate-700/50 pt-4">
				<p class="text-sm text-slate-400">
					<span class="font-medium">Kubernetes Version:</span>
					{healthCheck.kubernetesVersion}
				</p>
			</div>
		{/if}

		<div class="mt-6 flex flex-col gap-3 border-t border-slate-700/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
			<form
				id="health-check-retest-form"
				method="POST"
				action="?/test"
				use:enhance={() => {
					return async ({ result, update }) => {
						await update();
						if (result.type === 'success' || result.type === 'failure') await invalidateAll();
					};
				}}
				class="flex"
			>
				<input type="hidden" name="_csrf" value={getCsrfToken()} />
				<input type="hidden" name="clusterId" value={activeClusterId ?? ''} />
				<Button type="submit" disabled={!activeClusterId}>Retest connection</Button>
			</form>
			<Button type="button" variant="ghost" onclick={onClose}>Back to Clusters</Button>
		</div>
	</div>
</div>
