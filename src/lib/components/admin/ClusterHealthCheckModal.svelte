<script lang="ts">
	import type { ClusterRecoverySummary, ClusterRecoverySummaryAction } from '$lib/clusters/recovery';
	import type { ClusterHealthCheck } from '$lib/server/clusters';
	import ClusterHealthCheckFooter from './ClusterHealthCheckFooter.svelte';
	import ClusterHealthCheckHeader from './ClusterHealthCheckHeader.svelte';
	import ClusterHealthCheckRecovery from './ClusterHealthCheckRecovery.svelte';
	import ClusterHealthCheckResults from './ClusterHealthCheckResults.svelte';

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
		<ClusterHealthCheckHeader
			clusterName={healthCheck.clusterName}
			connected={healthCheck.connected}
			{onClose}
		/>

		{#if recoverySummary}
			<ClusterHealthCheckRecovery
				summary={recoverySummary}
				errorSummary={healthCheckErrorSummary}
				onAction={onRecoveryAction}
			/>
		{/if}

		<ClusterHealthCheckResults
			checks={healthCheck.checks}
			kubernetesVersion={healthCheck.kubernetesVersion}
		/>
		<ClusterHealthCheckFooter {activeClusterId} {onClose} />
	</div>
</div>
