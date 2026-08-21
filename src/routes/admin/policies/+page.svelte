<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll, goto } from '$app/navigation';
	import { buildAdminPageUrl, buildAdminSearchUrl } from '$lib/admin/navigation';
	import { getCsrfToken } from '$lib/utils/csrf';
	import Button from '$lib/components/ui/button/button.svelte';
	import AdminConfirmDialog from '$lib/components/admin/AdminConfirmDialog.svelte';
	import { resourceGroups } from '$lib/config/resources';
	import PolicyCard from '$lib/components/admin/PolicyCard.svelte';
	import type { Policy, PolicyUser } from '$lib/components/admin/policy-types';
	import SearchBar from '$lib/components/ui/search/SearchBar.svelte';
	import Pagination from '$lib/components/ui/pagination/Pagination.svelte';
	import * as Select from '$lib/components/ui/select';

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

	let newPolicy = $state({
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
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			aria-labelledby="create-policy-title"
			onclick={(e) => e.target === e.currentTarget && closeModals()}
			onkeydown={(e) => e.key === 'Escape' && closeModals()}
		>
			<div
				class="h-full w-full overflow-y-auto border border-slate-700 bg-slate-800 p-6 shadow-2xl sm:h-auto sm:max-w-md sm:rounded-xl"
			>
				<h2 id="create-policy-title" class="mb-4 text-xl font-bold text-white">
					Create New Policy
				</h2>

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
					<input type="hidden" name="_csrf" value={getCsrfToken()} />
					<div>
						<label for="policyName" class="mb-1 block text-sm font-medium text-slate-300"
							>Policy Name</label
						>
						<input
							type="text"
							id="policyName"
							name="name"
							bind:value={newPolicy.name}
							required
							minlength="3"
							class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-amber-500 focus:outline-none"
							placeholder="e.g., Dev Namespace Access"
						/>
					</div>

					<div>
						<label for="policyDescription" class="mb-1 block text-sm font-medium text-slate-300"
							>Description (optional)</label
						>
						<textarea
							id="policyDescription"
							name="description"
							bind:value={newPolicy.description}
							rows="2"
							class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-amber-500 focus:outline-none"
							placeholder="What this policy grants access to..."
						></textarea>
					</div>

					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<label for="policyRole" class="mb-1 block text-sm font-medium text-slate-300"
								>Role</label
							>
							<Select.Root
								type="single"
								value={newPolicy.role}
								onValueChange={(v) => (newPolicy.role = v as 'admin' | 'editor' | 'viewer')}
							>
								<Select.Trigger id="policyRole" class="w-full">
									<Select.Value placeholder="Select Role">
										<span class="capitalize">{newPolicy.role}</span>
									</Select.Value>
								</Select.Trigger>
								<Select.Content>
									<Select.Item value="viewer">Viewer</Select.Item>
									<Select.Item value="editor">Editor</Select.Item>
									<Select.Item value="admin">Admin</Select.Item>
								</Select.Content>
							</Select.Root>
							<input type="hidden" name="role" value={newPolicy.role} />
						</div>

						<div>
							<label for="policyAction" class="mb-1 block text-sm font-medium text-slate-300"
								>Action</label
							>
							<Select.Root
								type="single"
								value={newPolicy.action}
								onValueChange={(v) => (newPolicy.action = v as 'read' | 'write' | 'admin')}
							>
								<Select.Trigger id="policyAction" class="w-full">
									<Select.Value placeholder="Select Action">
										<span class="capitalize">{newPolicy.action}</span>
									</Select.Value>
								</Select.Trigger>
								<Select.Content>
									<Select.Item value="read">Read</Select.Item>
									<Select.Item value="write">Write</Select.Item>
									<Select.Item value="admin">Admin</Select.Item>
								</Select.Content>
							</Select.Root>
							<input type="hidden" name="action" value={newPolicy.action} />
						</div>
					</div>

					<div>
						<label for="resourceType" class="mb-1 block text-sm font-medium text-slate-300"
							>Resource Type (optional)</label
						>
						<Select.Root
							type="single"
							value={newPolicy.resourceType}
							onValueChange={(v) => (newPolicy.resourceType = v)}
						>
							<Select.Trigger id="resourceType" class="w-full">
								<Select.Value placeholder="All Resources">
									{allResourceTypes.find((rt) => rt.value === newPolicy.resourceType)?.label ||
										'All Resources'}
								</Select.Value>
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="">All Resources</Select.Item>
								{#each allResourceTypes as rt (rt.value)}
									<Select.Item value={rt.value}>{rt.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="resourceType" value={newPolicy.resourceType} />
						<p class="mt-1 text-xs text-slate-500">Leave empty to apply to all resource types</p>
					</div>

					<div>
						<label for="namespacePattern" class="mb-1 block text-sm font-medium text-slate-300"
							>Namespace Pattern (optional)</label
						>
						<input
							type="text"
							id="namespacePattern"
							name="namespacePattern"
							bind:value={newPolicy.namespacePattern}
							class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-amber-500 focus:outline-none"
							placeholder="e.g., dev-* or production"
						/>
						<p class="mt-1 text-xs text-slate-500">
							Use * as wildcard. Leave empty for all namespaces.
						</p>
					</div>

					<div class="flex justify-end gap-3 pt-4">
						<Button type="button" variant="ghost" onclick={closeModals}>Cancel</Button>
						<Button
							type="submit"
							class="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 hover:from-amber-400 hover:to-amber-500"
						>
							Create Policy
						</Button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- Delete Confirmation Modal -->
	{#if deletingPolicy}
		<AdminConfirmDialog title="Delete Policy" titleId="delete-policy-title" onClose={closeModals}>
				<p class="mb-6 text-slate-400">
					Are you sure you want to delete <strong class="text-white">{deletingPolicy.name}</strong>?
					This will remove the policy from all assigned users. This action cannot be undone.
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
					<input type="hidden" name="policyId" value={deletingPolicy.id} />
					<input type="hidden" name="policyName" value={deletingPolicy.name} />
					<Button type="button" variant="ghost" onclick={closeModals}>Cancel</Button>
					<Button type="submit" variant="destructive">Delete Policy</Button>
				</form>
		</AdminConfirmDialog>
	{/if}

	<!-- Assign Policy Modal -->
	{#if assigningPolicy}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			aria-labelledby="assign-policy-title"
			onclick={(e) => e.target === e.currentTarget && closeModals()}
			onkeydown={(e) => e.key === 'Escape' && closeModals()}
		>
			<div
				class="h-full w-full overflow-y-auto border border-slate-700 bg-slate-800 p-6 shadow-2xl sm:h-auto sm:max-w-md sm:rounded-xl"
			>
				<h2 id="assign-policy-title" class="mb-4 text-xl font-bold text-white">Assign Policy</h2>
				<p class="mb-4 text-slate-400">
					Assign <strong class="text-white">{assigningPolicy.name}</strong> to a user:
				</p>

				<form
					method="POST"
					action="?/bind"
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
					<input type="hidden" name="_csrf" value={getCsrfToken()} />
					<input type="hidden" name="policyId" value={assigningPolicy.id} />
					<input type="hidden" name="policyName" value={assigningPolicy.name} />

					<div>
						<label for="userId" class="mb-1 block text-sm font-medium text-slate-300"
							>Select User</label
						>
						<Select.Root
							type="single"
							value={selectedUserId}
							onValueChange={(v) => (selectedUserId = v)}
						>
							<Select.Trigger id="userId" class="w-full">
								<Select.Value placeholder="Choose a user...">
									{data.users.find((u: PolicyUser) => u.id === selectedUserId)?.username || 'Choose a user...'}
								</Select.Value>
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="">Choose a user...</Select.Item>
								{#each data.users.filter((u: PolicyUser) => u.active && assigningPolicy && !getUsersWithPolicy(assigningPolicy.id).find((au: PolicyUser) => au.id === u.id)) as user (user.id)}
									<Select.Item value={user.id}>{user.username} ({user.role})</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="userId" value={selectedUserId} />
					</div>

					<div class="flex justify-end gap-3 pt-4">
						<Button type="button" variant="ghost" onclick={closeModals}>Cancel</Button>
						<Button
							type="submit"
							class="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 hover:from-amber-400 hover:to-amber-500"
						>
							Assign to User
						</Button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>
