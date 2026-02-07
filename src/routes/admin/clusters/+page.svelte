<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Button from '$lib/components/ui/button/button.svelte';

	interface Cluster {
		id: string;
		name: string;
		description: string | null;
		isActive: boolean;
		isLocal: boolean;
		contextCount: number;
		lastConnectedAt: Date | null;
		lastError: string | null;
		createdAt: Date;
	}

	interface HealthCheckResult {
		name: string;
		passed: boolean;
		message: string;
		details?: string;
		duration?: number;
	}

	interface ClusterHealthCheck {
		connected: boolean;
		clusterName: string;
		kubernetesVersion?: string;
		checks: HealthCheckResult[];
		error?: string;
		timestamp: string;
	}

	let { data, form } = $props<{
		data: { clusters: Cluster[] };
		form?: {
			error?: string;
			success?: boolean;
			message?: string;
			healthCheck?: ClusterHealthCheck;
		};
	}>();

	let showCreateModal = $state(false);
	let deletingCluster = $state<Cluster | null>(null);
	let showHealthCheckModal = $state(false);
	let kubeconfigInput = $state('');
	let isDragging = $state(false);
	let newCluster = $state({
		name: '',
		description: ''
	});

	function openHealthCheckModal() {
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

	function openDeleteModal(cluster: Cluster) {
		deletingCluster = cluster;
	}

	function closeModals() {
		showCreateModal = false;
		deletingCluster = null;
	}

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

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;

		const files = event.dataTransfer?.files;
		if (files && files.length > 0) {
			const file = files[0];
			if (
				file.name.endsWith('.json') ||
				file.name.endsWith('.yaml') ||
				file.name.endsWith('.yml')
			) {
				const reader = new FileReader();
				reader.onload = (e) => {
					kubeconfigInput = e.target?.result as string;
				};
				reader.readAsText(file);
			}
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
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

	<!-- Error Message -->
	{#if form?.error}
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
						onclick={openHealthCheckModal}
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
					onclick={openHealthCheckModal}
					class="text-red-300 hover:text-red-200"
				>
					View Diagnostics
				</Button>
			</div>
			{#if form.healthCheck.error}
				<p class="mt-2 text-sm">{form.healthCheck.error}</p>
			{/if}
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
	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
		{#each data.clusters as cluster (cluster.id)}
			<div class="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
				<div class="mb-3 flex items-start justify-between">
					<div>
						<div class="flex items-center gap-2">
							<h3 class="font-semibold text-white">{cluster.name}</h3>
							{#if !cluster.isLocal}
								<span class="rounded bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400"
									>In-Cluster</span
								>
							{/if}
						</div>
						{#if cluster.description}
							<p class="text-sm text-slate-400">{cluster.description}</p>
						{/if}
					</div>
					<div class="flex items-center gap-2">
						{#if cluster.isActive}
							<span class="flex h-2 w-2 rounded-full bg-emerald-400"></span>
						{:else}
							<span class="flex h-2 w-2 rounded-full bg-slate-400"></span>
						{/if}
					</div>
				</div>

				<!-- Cluster Details -->
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
						<div class="mt-2 rounded bg-red-500/10 p-2 text-xs text-red-400">
							{cluster.lastError}
						</div>
					{/if}
				</div>

				<!-- Actions -->
				<div class="flex justify-between gap-2 border-t border-slate-700/50 pt-3">
					<div class="flex gap-2">
						<form
							method="POST"
							action="?/test"
							use:enhance={() => {
								return async ({ result, update }) => {
									// Let the form update with the result data
									await update();

									if (result.type === 'success') {
										invalidateAll();
										// Open the health check modal automatically
										setTimeout(() => {
											openHealthCheckModal();
										}, 100);
									} else if (result.type === 'failure') {
										// Still open modal for failure to show diagnostics
										setTimeout(() => {
											openHealthCheckModal();
										}, 100);
									}
								};
							}}
							class="inline"
						>
							<input type="hidden" name="clusterId" value={cluster.id} />
							<Button type="submit" variant="ghost" size="sm" title="Test Connection">
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M13 10V3L4 14h7v7l9-11h-7z"
									/>
								</svg>
							</Button>
						</form>
						<form
							method="POST"
							action="?/toggle"
							use:enhance={() => {
								return async ({ result }) => {
									if (result.type === 'success') {
										invalidateAll();
									}
								};
							}}
							class="inline"
						>
							<input type="hidden" name="clusterId" value={cluster.id} />
							<input type="hidden" name="isActive" value={(!cluster.isActive).toString()} />
							<Button
								type="submit"
								variant="ghost"
								size="sm"
								title={cluster.isActive ? 'Disable' : 'Enable'}
							>
								{#if cluster.isActive}
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
										/>
									</svg>
								{:else}
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
										/>
									</svg>
								{/if}
							</Button>
						</form>
					</div>
					<Button
						variant="ghost"
						size="sm"
						onclick={() => openDeleteModal(cluster)}
						class="text-red-400 hover:text-red-300"
						title="Delete"
					>
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
							/>
						</svg>
					</Button>
				</div>
			</div>
		{/each}
	</div>

	{#if data.clusters.length === 0}
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
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="create-cluster-title"
			tabindex="-1"
			onclick={(e) => e.target === e.currentTarget && closeModals()}
			onkeydown={(e) => e.key === 'Escape' && closeModals()}
		>
			<div
				class="h-full w-full overflow-y-auto border border-slate-700 bg-slate-800 p-6 shadow-2xl sm:h-auto sm:max-w-2xl sm:rounded-xl"
			>
				<h2 id="create-cluster-title" class="mb-4 text-xl font-bold text-white">Add New Cluster</h2>

				<form
					method="POST"
					action="?/create"
					use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'success') {
								closeModals();
								invalidateAll();
							}
						};
					}}
					class="space-y-4"
				>
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div>
							<label for="clusterName" class="mb-1 block text-sm font-medium text-slate-300"
								>Cluster Name</label
							>
							<input
								type="text"
								id="clusterName"
								name="name"
								bind:value={newCluster.name}
								required
								minlength="3"
								class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-amber-500 focus:outline-none"
								placeholder="e.g., Production"
							/>
						</div>
						<div>
							<label for="clusterDescription" class="mb-1 block text-sm font-medium text-slate-300"
								>Description (optional)</label
							>
							<input
								type="text"
								id="clusterDescription"
								name="description"
								bind:value={newCluster.description}
								class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-amber-500 focus:outline-none"
								placeholder="e.g., Main production cluster"
							/>
						</div>
					</div>

					<div>
						<label for="kubeconfig" class="mb-1 block text-sm font-medium text-slate-300"
							>Kubeconfig</label
						>
						<div
							class="relative rounded-lg border-2 border-dashed {isDragging
								? 'border-amber-500 bg-amber-500/10'
								: 'border-slate-600'} transition-colors"
							role="region"
							aria-label="Kubeconfig drop zone"
							ondrop={handleDrop}
							ondragover={handleDragOver}
							ondragleave={handleDragLeave}
						>
							<textarea
								id="kubeconfig"
								name="kubeconfig"
								bind:value={kubeconfigInput}
								required
								rows="10"
								class="w-full resize-none rounded-lg border-0 bg-slate-700/50 px-3 py-2 font-mono text-xs text-white placeholder-slate-400 focus:ring-0"
								placeholder="Paste your kubeconfig YAML or JSON here...&#10;&#10;You can also drag and drop a .json, .yaml, or .yml file here."
							></textarea>
							{#if isDragging}
								<div
									class="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-800/80"
								>
									<p class="text-lg font-medium text-amber-400">Drop file here</p>
								</div>
							{/if}
						</div>
						<p class="mt-1 text-xs text-slate-500">
							Accepts kubeconfig in YAML or JSON format. The config will be encrypted before
							storage.
						</p>
					</div>

					<div class="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
						<div class="flex items-start gap-2">
							<svg
								class="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							<p class="text-xs text-blue-300">
								<strong>Security Note:</strong> Your kubeconfig will be encrypted using AES-256-GCM before
								being stored in the database. Only Gyre can decrypt it using the instance-specific encryption
								key.
							</p>
						</div>
					</div>

					<div class="flex justify-end gap-3 pt-4">
						<Button type="button" variant="ghost" onclick={closeModals}>Cancel</Button>
						<Button
							type="submit"
							class="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 hover:from-amber-400 hover:to-amber-500"
						>
							Add Cluster
						</Button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- Delete Confirmation Modal -->
	{#if deletingCluster}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="delete-cluster-title"
			tabindex="-1"
			onclick={(e) => e.target === e.currentTarget && closeModals()}
			onkeydown={(e) => e.key === 'Escape' && closeModals()}
		>
			<div
				class="h-full w-full overflow-y-auto border border-red-500/30 bg-slate-800 p-6 shadow-2xl sm:h-auto sm:max-w-md sm:rounded-xl"
			>
				<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
					<svg class="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
				</div>
				<h2 id="delete-cluster-title" class="mb-2 text-xl font-bold text-white">Delete Cluster</h2>
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
					<input type="hidden" name="clusterId" value={deletingCluster.id} />
					<input type="hidden" name="clusterName" value={deletingCluster.name} />
					<Button type="button" variant="ghost" onclick={closeModals}>Cancel</Button>
					<Button type="submit" variant="destructive">Delete Cluster</Button>
				</form>
			</div>
		</div>
	{/if}

	<!-- Health Check Details Modal -->
	{#if showHealthCheckModal && form?.healthCheck}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div
				class="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-2xl"
			>
				<div class="mb-4 flex items-center justify-between">
					<div class="flex items-center gap-3">
						<div
							class="flex h-12 w-12 items-center justify-center rounded-full {form.healthCheck
								.connected
								? 'bg-emerald-500/20'
								: 'bg-red-500/20'}"
						>
							{#if form.healthCheck.connected}
								<svg
									class="h-6 w-6 text-emerald-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M5 13l4 4L19 7"
									/>
								</svg>
							{:else}
								<svg
									class="h-6 w-6 text-red-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
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
							<p class="text-sm text-slate-400">{form.healthCheck.clusterName}</p>
						</div>
					</div>
					<button
						onclick={closeHealthCheckModal}
						class="text-slate-400 hover:text-white"
						aria-label="Close"
					>
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

				<div class="space-y-3">
					{#each form.healthCheck.checks as check (check.name)}
						<div
							class="rounded-lg border {check.passed
								? 'border-emerald-500/30 bg-emerald-500/5'
								: 'border-red-500/30 bg-red-500/5'} p-4"
						>
							<div class="flex items-start gap-3">
								<div class="mt-0.5 flex-shrink-0">
									{#if check.passed}
										<svg
											class="h-5 w-5 text-emerald-400"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M5 13l4 4L19 7"
											/>
										</svg>
									{:else}
										<svg
											class="h-5 w-5 text-red-400"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
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
										<p class="mt-2 rounded bg-slate-900/50 p-2 text-xs text-slate-400">
											{check.details}
										</p>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>

				{#if form.healthCheck.kubernetesVersion}
					<div class="mt-4 border-t border-slate-700/50 pt-4">
						<p class="text-sm text-slate-400">
							<span class="font-medium">Kubernetes Version:</span>
							{form.healthCheck.kubernetesVersion}
						</p>
					</div>
				{/if}

				<div class="mt-6 flex justify-end">
					<Button type="button" variant="ghost" onclick={closeHealthCheckModal}>Close</Button>
				</div>
			</div>
		</div>
	{/if}
</div>
