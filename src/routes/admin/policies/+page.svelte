<script lang="ts">
		import { goto } from '$app/navigation';
	import { buildAdminPageUrl, buildAdminSearchUrl } from '$lib/admin/navigation';
		import Button from '$lib/components/ui/button/button.svelte';
		import { resourceGroups } from '$lib/config/resources';
	import PolicyCard from '$lib/components/admin/PolicyCard.svelte';
	import PolicyCreateModal from '$lib/components/admin/PolicyCreateModal.svelte';
	import PolicyDeleteDialog from '$lib/components/admin/PolicyDeleteDialog.svelte';
	import PolicyAssignModal from '$lib/components/admin/PolicyAssignModal.svelte';
	import type { NewPolicy, Policy, PolicyUser } from '$lib/components/admin/policy-types';
	import SearchBar from '$lib/components/ui/search/SearchBar.svelte';
	import Pagination from '$lib/components/ui/pagination/Pagination.svelte';

	interface PageData {
		policies: Policy[];
		users: PolicyUser[];
		userPolicies: Record<string, Policy[]>;
		total: number;
		search: string;
		limit: number;
		offset: number;
	}

	let { data, form } = $props<{
		data: PageData;
		form?: { error?: string; success?: boolean; policyId?: string };
	}>();

	let showCreateModal = $state(false);
	let deletingPolicy = $state<Policy | null>(null);
	let assigningPolicy = $state<Policy | null>(null);
	let selectedUserId = $state('');
	let searchValue = $state('');

	// Sync searchValue with data.search changes (e.g., back/forward navigation)
	$effect.pre(() => {
		searchValue = data.search;
	});

	let newPolicy = $state<NewPolicy>({
		name: '',
		description: '',
		role: 'viewer' as 'admin' | 'editor' | 'viewer',
		action: 'read' as 'read' | 'write' | 'admin',
		resourceType: '',
		namespacePattern: ''
	});

	function handleSearch(value: string) {
		searchValue = value;
		goto(buildAdminSearchUrl(value));
	}

	function handlePageChange(newOffset: number) {
		goto(buildAdminPageUrl(newOffset));
	}

	// Get all resource types from config
	const allResourceTypes = resourceGroups.flatMap((g) =>
		g.resources.map((r) => ({
			label: r.displayName,
			value: r.type
		}))
	);

	function openCreateModal() {
		newPolicy = {
			name: '',
			description: '',
			role: 'viewer',
			action: 'read',
			resourceType: '',
			namespacePattern: ''
		};
		showCreateModal = true;
	}

	function openDeleteModal(policy: Policy) {
		deletingPolicy = policy;
	}

	function openAssignModal(policy: Policy) {
		assigningPolicy = policy;
		selectedUserId = '';
	}

	function closeModals() {
		showCreateModal = false;
		deletingPolicy = null;
		assigningPolicy = null;
		selectedUserId = '';
	}

	function getRoleBadgeColor(role: string) {
		switch (role) {
			case 'admin':
				return 'bg-red-500/20 text-red-400 border-red-500/30';
			case 'editor':
				return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
			case 'viewer':
				return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
			default:
				return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
		}
	}

	function getActionBadgeColor(action: string) {
		switch (action) {
			case 'admin':
				return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
			case 'write':
				return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
			case 'read':
				return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
			default:
				return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
		}
	}

	function getUsersWithPolicy(policyId: string): PolicyUser[] {
		const userIds = Object.entries(data.userPolicies as Record<string, Policy[]>)
			.filter(([, policies]: [string, Policy[]]) => policies.some((p: Policy) => p.id === policyId))
			.map(([userId]: [string, Policy[]]) => userId);

		return data.users.filter((u: PolicyUser) => userIds.includes(u.id));
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
		<div>
			<h1 class="text-2xl font-bold text-white">RBAC Policies</h1>
			<p class="text-slate-400">Manage access control policies and user bindings</p>
		</div>
		<Button onclick={openCreateModal} class="w-full gap-2 sm:w-auto">
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
			</svg>
			Create Policy
		</Button>
	</div>

	<!-- Search Bar -->
	<SearchBar value={searchValue} placeholder="Search policies by name or description..." onSearch={handleSearch} />

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
			<div class="flex items-center gap-2">
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M5 13l4 4L19 7"
					/>
				</svg>
				Operation completed successfully
			</div>
		</div>
	{/if}

	<!-- Policies Grid -->
	{#if data.policies.length > 0}
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each data.policies as policy (policy.id)}
				<PolicyCard
					{policy}
					assignedUsers={getUsersWithPolicy(policy.id)}
					roleBadgeColor={getRoleBadgeColor(policy.role)}
					actionBadgeColor={getActionBadgeColor(policy.action)}
					onAssign={openAssignModal}
					onDelete={openDeleteModal}
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
							d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
						/>
					</svg>
				</div>
			</div>
			<h3 class="mb-2 text-lg font-medium text-white">No policies yet</h3>
			<p class="mb-6 text-slate-400">Create your first RBAC policy to control user access</p>
			<Button onclick={openCreateModal}>Create Policy</Button>
		</div>
	{/if}

	<!-- Create Policy Modal -->
	{#if showCreateModal}
		<PolicyCreateModal bind:newPolicy {allResourceTypes} onClose={closeModals} />
	{/if}

	<!-- Delete Confirmation Modal -->
	{#if deletingPolicy}
		<PolicyDeleteDialog policy={deletingPolicy} onClose={closeModals} />
	{/if}

	<!-- Assign Policy Modal -->
	{#if assigningPolicy}
		<PolicyAssignModal
			policy={assigningPolicy}
			users={data.users}
			assignedUsers={getUsersWithPolicy(assigningPolicy.id)}
			bind:selectedUserId
			onClose={closeModals}
		/>
	{/if}

</div>
