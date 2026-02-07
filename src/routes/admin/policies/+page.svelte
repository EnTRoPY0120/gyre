<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Button from '$lib/components/ui/button/button.svelte';
	import { resourceGroups } from '$lib/config/resources';

	interface Policy {
		id: string;
		name: string;
		description: string | null;
		role: 'admin' | 'editor' | 'viewer';
		action: 'read' | 'write' | 'admin';
		resourceType: string | null;
		namespacePattern: string | null;
		clusterId: string | null;
		isActive: boolean;
		createdAt: Date;
		updatedAt: Date;
	}

	interface User {
		id: string;
		username: string;
		role: 'admin' | 'editor' | 'viewer';
		active: boolean;
	}

	interface PageData {
		policies: Policy[];
		users: User[];
		userPolicies: Record<string, Policy[]>;
	}

	let { data, form } = $props<{
		data: PageData;
		form?: { error?: string; success?: boolean; policyId?: string };
	}>();

	let showCreateModal = $state(false);
	let deletingPolicy = $state<Policy | null>(null);
	let assigningPolicy = $state<Policy | null>(null);
	let selectedUserId = $state('');

	let newPolicy = $state({
		name: '',
		description: '',
		role: 'viewer' as const,
		action: 'read' as const,
		resourceType: '',
		namespacePattern: ''
	});

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

	function getUsersWithPolicy(policyId: string): User[] {
		const userIds = Object.entries(data.userPolicies as Record<string, Policy[]>)
			.filter(([, policies]: [string, Policy[]]) => policies.some((p: Policy) => p.id === policyId))
			.map(([userId]: [string, Policy[]]) => userId);

		return data.users.filter((u: User) => userIds.includes(u.id));
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
	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
		{#each data.policies as policy (policy.id)}
			<div class="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
				<div class="mb-3 flex items-start justify-between">
					<div>
						<h3 class="font-semibold text-white">{policy.name}</h3>
						{#if policy.description}
							<p class="text-sm text-slate-400">{policy.description}</p>
						{/if}
					</div>
					{#if !policy.isActive}
						<span class="rounded bg-slate-700 px-2 py-1 text-xs text-slate-400">Inactive</span>
					{/if}
				</div>

				<!-- Policy Details -->
				<div class="mb-3 space-y-2">
					<div class="flex items-center gap-2">
						<span class="text-xs text-slate-500">Role:</span>
						<span
							class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium {getRoleBadgeColor(
								policy.role
							)}"
						>
							{policy.role}
						</span>
					</div>
					<div class="flex items-center gap-2">
						<span class="text-xs text-slate-500">Action:</span>
						<span
							class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium {getActionBadgeColor(
								policy.action
							)}"
						>
							{policy.action}
						</span>
					</div>
					{#if policy.resourceType}
						<div class="flex items-center gap-2">
							<span class="text-xs text-slate-500">Resource:</span>
							<span class="text-xs text-slate-300">{policy.resourceType}</span>
						</div>
					{/if}
					{#if policy.namespacePattern}
						<div class="flex items-center gap-2">
							<span class="text-xs text-slate-500">Namespace:</span>
							<code class="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-amber-400"
								>{policy.namespacePattern}</code
							>
						</div>
					{/if}
				</div>

				<!-- Assigned Users -->
				<div class="mb-3">
					<p class="mb-1 text-xs text-slate-500">Assigned to:</p>
					{#if getUsersWithPolicy(policy.id).length > 0}
						{@const assignedUsers = getUsersWithPolicy(policy.id)}
						<div class="flex flex-wrap gap-1">
							{#each assignedUsers as user (user.id)}
								<form
									method="POST"
									action="?/unbind"
									use:enhance={() => {
										return async ({ result }) => {
											if (result.type === 'success') {
												invalidateAll();
											}
										};
									}}
									class="inline"
								>
									<input type="hidden" name="userId" value={user.id} />
									<input type="hidden" name="policyId" value={policy.id} />
									<input type="hidden" name="policyName" value={policy.name} />
									<button
										type="submit"
										class="inline-flex items-center gap-1 rounded-full bg-slate-700 px-2 py-1 text-xs text-slate-300 transition-colors hover:bg-red-500/20 hover:text-red-400"
									>
										{user.username}
										<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M6 18L18 6M6 6l12 12"
											/>
										</svg>
									</button>
								</form>
							{/each}
						</div>
					{:else}
						<span class="text-xs text-slate-500 italic">Not assigned to any users</span>
					{/if}
				</div>

				<!-- Actions -->
				<div class="flex justify-end gap-2 border-t border-slate-700/50 pt-3">
					<Button
						variant="ghost"
						size="sm"
						onclick={() => openAssignModal(policy)}
						title="Assign to User"
					>
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
							/>
						</svg>
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onclick={() => openDeleteModal(policy)}
						class="text-red-400 hover:text-red-300"
						title="Delete Policy"
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

	{#if data.policies.length === 0}
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
							<select
								id="policyRole"
								name="role"
								bind:value={newPolicy.role}
								required
								class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
							>
								<option value="viewer">Viewer</option>
								<option value="editor">Editor</option>
								<option value="admin">Admin</option>
							</select>
						</div>

						<div>
							<label for="policyAction" class="mb-1 block text-sm font-medium text-slate-300"
								>Action</label
							>
							<select
								id="policyAction"
								name="action"
								bind:value={newPolicy.action}
								required
								class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
							>
								<option value="read">Read</option>
								<option value="write">Write</option>
								<option value="admin">Admin</option>
							</select>
						</div>
					</div>

					<div>
						<label for="resourceType" class="mb-1 block text-sm font-medium text-slate-300"
							>Resource Type (optional)</label
						>
						<select
							id="resourceType"
							name="resourceType"
							bind:value={newPolicy.resourceType}
							class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
						>
							<option value="">All Resources</option>
							{#each allResourceTypes as rt (rt.value)}
								<option value={rt.value}>{rt.label}</option>
							{/each}
						</select>
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
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			aria-labelledby="delete-policy-title"
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
				<h2 id="delete-policy-title" class="mb-2 text-xl font-bold text-white">Delete Policy</h2>
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
					<input type="hidden" name="policyId" value={deletingPolicy.id} />
					<input type="hidden" name="policyName" value={deletingPolicy.name} />
					<Button type="button" variant="ghost" onclick={closeModals}>Cancel</Button>
					<Button type="submit" variant="destructive">Delete Policy</Button>
				</form>
			</div>
		</div>
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
					<input type="hidden" name="policyId" value={assigningPolicy.id} />
					<input type="hidden" name="policyName" value={assigningPolicy.name} />

					<div>
						<label for="userId" class="mb-1 block text-sm font-medium text-slate-300"
							>Select User</label
						>
						<select
							id="userId"
							name="userId"
							bind:value={selectedUserId}
							required
							class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
						>
							<option value="">Choose a user...</option>
							{#each data.users.filter((u: User) => u.active && assigningPolicy && !getUsersWithPolicy(assigningPolicy.id).find((au: User) => au.id === u.id)) as user (user.id)}
								<option value={user.id}>{user.username} ({user.role})</option>
							{/each}
						</select>
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
