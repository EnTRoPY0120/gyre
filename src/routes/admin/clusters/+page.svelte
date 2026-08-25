<script lang="ts">
	import { goto } from '$app/navigation';
	import { buildAdminPageUrl, buildAdminSearchUrl } from '$lib/admin/navigation';
	import { deriveClusterRecoverySummary } from '$lib/clusters/recovery';
	import Button from '$lib/components/ui/button/button.svelte';
	import ClusterDeleteDialog from '$lib/components/admin/ClusterDeleteDialog.svelte';
	import ClusterCollection from '$lib/components/admin/ClusterCollection.svelte';
	import ClusterCreateModal from '$lib/components/admin/ClusterCreateModal.svelte';
	import ClusterHealthCheckModal from '$lib/components/admin/ClusterHealthCheckModal.svelte';
	import ClusterPageFeedback from '$lib/components/admin/ClusterPageFeedback.svelte';
	import type { ClusterSummary } from '$lib/components/admin/cluster-types';
	import SearchBar from '$lib/components/ui/search/SearchBar.svelte';
	import type { ClusterHealthCheck, HealthCheckResult } from '$lib/server/clusters';

	let { data, form } = $props<{
		data: {
			clusters: ClusterSummary[];
			total: number;
			search: string;
			limit: number;
			offset: number;
			urlError: string | null;
		};
		form?: {
			error?: string;
			success?: boolean;
			message?: string;
			healthCheck?: ClusterHealthCheck;
		};
	}>();

	let showCreateModal = $state(false);
	let deletingCluster = $state<ClusterSummary | null>(null);
	let showHealthCheckModal = $state(false);
	let activeHealthCheckClusterId = $state<string | null>(null);
	let kubeconfigInput = $state('');
	let isDragging = $state(false);
	let searchValue = $state('');
	const recoverySummary = $derived.by(() =>
		form?.healthCheck?.connected === false
			? deriveClusterRecoverySummary(form.healthCheck.checks)
			: null
	);
	const healthCheckErrorSummary = $derived(
		form?.healthCheck?.error ??
		form?.healthCheck?.checks.find((check: HealthCheckResult) => !check.passed)?.message ??
		null
	);

	// Sync searchValue with data.search changes (e.g., back/forward navigation)
	$effect.pre(() => {
		searchValue = data.search;
	});
	let newCluster = $state({
		name: '',
		description: ''
	});

	function handleSearch(value: string) {
		searchValue = value;
		goto(buildAdminSearchUrl(value));
	}

	function handlePageChange(newOffset: number) {
		goto(buildAdminPageUrl(newOffset));
	}

	function openHealthCheckModal(clusterId?: string) {
		if (clusterId) {
			activeHealthCheckClusterId = clusterId;
		}
		if (form?.healthCheck) {
			showHealthCheckModal = true;
		}
	}

	function closeHealthCheckModal() {
		showHealthCheckModal = false;
	}

	function openCreateModal() {
		newCluster = { name: '', description: '' };
		kubeconfigInput = '';
		showCreateModal = true;
	}

	function openDeleteModal(cluster: ClusterSummary) {
		deletingCluster = cluster;
	}

	function closeModals() {
		showCreateModal = false;
		deletingCluster = null;
	}

	function handleRecoveryAction(action: 'openCreateModal' | 'retest') {
		if (action === 'openCreateModal') {
			closeHealthCheckModal();
			openCreateModal();
			return;
		}

		if (action === 'retest' && activeHealthCheckClusterId) {
			const retestFormEl = document.getElementById('health-check-retest-form') as HTMLFormElement | null;
			retestFormEl?.requestSubmit();
		}
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
		<div>
			<h1 class="text-2xl font-bold text-white">Cluster Management</h1>
			<p class="text-slate-400">Manage Kubernetes clusters and kubeconfig uploads</p>
		</div>
		<Button onclick={openCreateModal} class="w-full gap-2 sm:w-auto">
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
			</svg>
			Add Cluster
		</Button>
	</div>

	<!-- Search Bar -->
	<SearchBar value={searchValue} placeholder="Search clusters by name or description..." onSearch={handleSearch} />

	<ClusterPageFeedback
		form={form}
		urlError={data.urlError}
		onViewHealthCheck={() => openHealthCheckModal()}
	/>

	<ClusterCollection
		clusters={data.clusters}
		total={data.total}
		limit={data.limit}
		offset={data.offset}
		onPageChange={handlePageChange}
		onAdd={openCreateModal}
		onDelete={openDeleteModal}
		onHealthCheck={openHealthCheckModal}
	/>

	<!-- Create Cluster Modal -->
	{#if showCreateModal}
		<ClusterCreateModal
			{newCluster}
			{kubeconfigInput}
			{isDragging}
			onClusterChange={(field, value) => (newCluster = { ...newCluster, [field]: value })}
			onKubeconfigChange={(value) => (kubeconfigInput = value)}
			onDraggingChange={(dragging) => (isDragging = dragging)}
			onClose={closeModals}
		/>
	{/if}

	<!-- Delete Confirmation Modal -->
	{#if deletingCluster}
		<ClusterDeleteDialog cluster={deletingCluster} onClose={closeModals} />
	{/if}

	<!-- Health Check Details Modal -->
	{#if showHealthCheckModal && form?.healthCheck}
		<ClusterHealthCheckModal
			healthCheck={form.healthCheck}
			{recoverySummary}
			{healthCheckErrorSummary}
			activeClusterId={activeHealthCheckClusterId}
			onClose={closeHealthCheckModal}
			onRecoveryAction={handleRecoveryAction}
		/>
	{/if}
</div>
