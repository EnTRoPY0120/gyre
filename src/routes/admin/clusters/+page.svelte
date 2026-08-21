<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll, goto } from '$app/navigation';
	import { buildAdminPageUrl, buildAdminSearchUrl } from '$lib/admin/navigation';
	import { deriveClusterRecoverySummary } from '$lib/clusters/recovery';
	import { getCsrfToken } from '$lib/utils/csrf';
	import Button from '$lib/components/ui/button/button.svelte';
	import AdminConfirmDialog from '$lib/components/admin/AdminConfirmDialog.svelte';
	import ClusterCard from '$lib/components/admin/ClusterCard.svelte';
	import ClusterCreateModal from '$lib/components/admin/ClusterCreateModal.svelte';
	import ClusterHealthCheckModal from '$lib/components/admin/ClusterHealthCheckModal.svelte';
	import type { ClusterSummary } from '$lib/components/admin/cluster-types';
	import SearchBar from '$lib/components/ui/search/SearchBar.svelte';
	import Pagination from '$lib/components/ui/pagination/Pagination.svelte';
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
	const healthCheckErrorSummary = $derived.by(() => {
		if (!form?.healthCheck) {
			return null;
		}

		return (
			form.healthCheck.error ??
			form.healthCheck.checks.find((check: HealthCheckResult) => !check.passed)?.message ??
			null
		);
	});

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

	<!-- Error Message (from form action or middleware redirect) -->
	{#if form?.error || data.urlError}
		<div class="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
			<div class="flex items-center gap-2">
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				{form?.error ?? data.urlError}
			</div>
		</div>
	{/if}

	<!-- Success Message -->
	{#if form?.success}
		<div class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-400">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M5 13l4 4L19 7"
						/>
					</svg>
					<span class="font-medium">Connection successful!</span>
				</div>
				{#if form?.healthCheck}
					<Button
						variant="ghost"
						size="sm"
						onclick={() => openHealthCheckModal()}
						class="text-emerald-300 hover:text-emerald-200"
					>
						View Details
					</Button>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Error Message with Details Button -->
	{#if form?.error && form?.healthCheck}
		<div class="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<span class="font-medium">Connection failed</span>
				</div>
				<Button
					variant="ghost"
					size="sm"
					onclick={() => openHealthCheckModal()}
					class="text-red-300 hover:text-red-200"
				>
					View Diagnostics
				</Button>
			</div>
			<p class="mt-2 text-sm">
				Connection checks failed. Open diagnostics for the detailed failure reason and checklist.
			</p>
		</div>
	{:else if form?.error}
		<div class="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
			<div class="flex items-center gap-2">
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				{form.error}
			</div>
		</div>
	{/if}

	<!-- Clusters Grid -->
	{#if data.clusters.length > 0}
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each data.clusters as cluster (cluster.id)}
				<ClusterCard
					{cluster}
					onDelete={openDeleteModal}
					onHealthCheck={openHealthCheckModal}
				/>
			{/each}
		</div>

		<!-- Pagination -->
		<Pagination total={data.total} limit={data.limit} offset={data.offset} onPageChange={handlePageChange} />
	{:else}
		<div class="rounded-xl border border-slate-700/50 bg-slate-800/50 p-12 text-center">
			<div class="mb-4 flex justify-center">
				<div class="flex h-16 w-16 items-center justify-center rounded-full bg-slate-700">
					<svg class="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
						/>
					</svg>
				</div>
			</div>
			<h3 class="mb-2 text-lg font-medium text-white">No clusters configured</h3>
			<p class="mb-6 text-slate-400">Add your first Kubernetes cluster by uploading a kubeconfig</p>
			<Button onclick={openCreateModal}>Add Cluster</Button>
		</div>
	{/if}

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
		<AdminConfirmDialog title="Delete Cluster" titleId="delete-cluster-title" onClose={closeModals}>
				<p class="mb-6 text-slate-400">
					Are you sure you want to delete <strong class="text-white">{deletingCluster.name}</strong
					>? This will remove the cluster configuration and all associated data. This action cannot
					be undone.
				</p>

				<form
					method="POST"
					action="?/delete"
					use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'success') {
								closeModals();
								invalidateAll();
							}
						};
					}}
					class="flex justify-end gap-3"
				>
					<input type="hidden" name="_csrf" value={getCsrfToken()} />
					<input type="hidden" name="clusterId" value={deletingCluster.id} />
					<input type="hidden" name="clusterName" value={deletingCluster.name} />
					<Button type="button" variant="ghost" onclick={closeModals}>Cancel</Button>
					<Button type="submit" variant="destructive">Delete Cluster</Button>
				</form>
		</AdminConfirmDialog>
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
