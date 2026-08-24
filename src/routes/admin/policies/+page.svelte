<script lang="ts">
	import { goto } from '$app/navigation';
	import { buildAdminPageUrl, buildAdminSearchUrl } from '$lib/admin/navigation';
	import { resourceGroups } from '$lib/config/resources';
	import PolicyCreateModal from '$lib/components/admin/PolicyCreateModal.svelte';
	import PolicyDeleteDialog from '$lib/components/admin/PolicyDeleteDialog.svelte';
	import PolicyAssignModal from '$lib/components/admin/PolicyAssignModal.svelte';
	import type { NewPolicy, Policy, PolicyUser } from '$lib/components/admin/policy-types';
	import SearchBar from '$lib/components/ui/search/SearchBar.svelte';
	import PolicyList from './PolicyList.svelte';
	import PolicyPageHeader from './PolicyPageHeader.svelte';

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

	$effect.pre(() => {
		searchValue = data.search;
	});

	let newPolicy = $state<NewPolicy>({
		name: '',
		description: '',
		role: 'viewer',
		action: 'read',
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

	const allResourceTypes = resourceGroups.flatMap((g) =>
		g.resources.map((r) => ({ label: r.displayName, value: r.type }))
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
			.filter(([, policies]) => policies.some((policy) => policy.id === policyId))
			.map(([userId]) => userId);

		return data.users.filter((user: PolicyUser) => userIds.includes(user.id));
	}
</script>

<div class="space-y-6">
	<PolicyPageHeader onCreate={openCreateModal} />
	<SearchBar
		value={searchValue}
		placeholder="Search policies by name or description..."
		onSearch={handleSearch}
	/>

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

	<PolicyList
		policies={data.policies}
		usersWithPolicy={getUsersWithPolicy}
		total={data.total}
		limit={data.limit}
		offset={data.offset}
		{getRoleBadgeColor}
		{getActionBadgeColor}
		onAssign={openAssignModal}
		onDelete={openDeleteModal}
		onPageChange={handlePageChange}
		onCreate={openCreateModal}
	/>

	{#if showCreateModal}
		<PolicyCreateModal bind:newPolicy {allResourceTypes} onClose={closeModals} />
	{/if}

	{#if deletingPolicy}
		<PolicyDeleteDialog policy={deletingPolicy} onClose={closeModals} />
	{/if}

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
