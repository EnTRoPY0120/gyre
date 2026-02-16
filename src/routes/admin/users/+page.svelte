<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll, goto } from '$app/navigation';
	import { page } from '$app/stores';
	import Button from '$lib/components/ui/button/button.svelte';
	import { UserPlus, AlertTriangle, CheckCircle2, XCircle } from 'lucide-svelte';
	import SearchBar from '$lib/components/ui/search/SearchBar.svelte';
	import Pagination from '$lib/components/ui/pagination/Pagination.svelte';

	interface User {
		id: string;
		username: string;
		email: string | null;
		role: 'admin' | 'editor' | 'viewer';
		active: boolean;
		isLocal: boolean;
		createdAt: Date;
		updatedAt: Date;
	}

	let { data, form } = $props<{
		data: {
			users: User[];
			currentUser: User;
			total: number;
			search: string;
			limit: number;
			offset: number;
		};
		form?: { error?: string; success?: boolean; password?: string };
	}>();

	let showCreateModal = $state(false);
	let editingUser = $state<User | null>(null);
	let deletingUser = $state<User | null>(null);
	let resettingPassword = $state<User | null>(null);
	let generatedPassword = $state('');
	let searchValue = $state(data.search);

	let newUser = $state({
		username: '',
		email: '',
		role: 'viewer' as const,
		password: ''
	});

	function handleSearch(value: string) {
		searchValue = value;
		const url = new URL(window.location.href);
		if (value) {
			url.searchParams.set('search', value);
		} else {
			url.searchParams.delete('search');
		}
		url.searchParams.set('offset', '0'); // Reset to first page on search
		goto(url.toString());
	}

	function handlePageChange(newOffset: number) {
		const url = new URL(window.location.href);
		url.searchParams.set('offset', newOffset.toString());
		goto(url.toString());
	}

	function generatePassword() {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
		let password = '';
		for (let i = 0; i < 12; i++) {
			password += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return password;
	}

	function openCreateModal() {
		newUser = {
			username: '',
			email: '',
			role: 'viewer',
			password: generatePassword()
		};
		showCreateModal = true;
	}

	function openEditModal(user: User) {
		editingUser = user;
	}

	function openDeleteModal(user: User) {
		deletingUser = user;
	}

	function openResetPasswordModal(user: User) {
		resettingPassword = user;
		generatedPassword = generatePassword();
	}

	function closeModals() {
		showCreateModal = false;
		editingUser = null;
		deletingUser = null;
		resettingPassword = null;
		generatedPassword = '';
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

	function formatDate(date: Date) {
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
		<div>
			<h1 class="text-2xl font-bold text-white">User Management</h1>
			<p class="text-slate-400">Manage users and their permissions</p>
		</div>
		<Button onclick={openCreateModal} class="w-full gap-2 sm:w-auto" aria-label="Add User">
			<UserPlus size={16} />
			<span class="hidden sm:inline">Add User</span>
		</Button>
	</div>

	<!-- Search Bar -->
	<SearchBar value={searchValue} placeholder="Search users by name or email..." onSearch={handleSearch} />

	<!-- Error Message -->
	{#if form?.error}
		<div class="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
			<div class="flex items-center gap-2">
				<AlertTriangle size={20} />
				{form.error}
			</div>
		</div>
	{/if}

	<!-- Success Message -->
	{#if form?.success}
		<div class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-400">
			<div class="flex items-center gap-2">
				<CheckCircle2 size={20} />
				Operation completed successfully
			</div>
			{#if form?.password}
				<div class="mt-2 rounded bg-slate-900 p-3">
					<p class="text-xs text-slate-400">Generated Password:</p>
					<p class="font-mono text-sm text-amber-400">{form.password}</p>
					<p class="mt-1 text-xs text-slate-500">Copy this now - it won't be shown again</p>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Users Table -->
	<div class="rounded-xl border border-slate-700/50 bg-slate-800/50">
		<table class="w-full">
			<thead>
				<tr class="border-b border-slate-700/50">
					<th class="px-4 py-3 text-left text-sm font-medium text-slate-400">User</th>
					<th class="px-4 py-3 text-left text-sm font-medium text-slate-400">Role</th>
					<th class="hidden px-4 py-3 text-left text-sm font-medium text-slate-400 md:table-cell"
						>Status</th
					>
					<th class="hidden px-4 py-3 text-left text-sm font-medium text-slate-400 sm:table-cell"
						>Created</th
					>
					<th class="px-4 py-3 text-right text-sm font-medium text-slate-400">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-700/50">
				{#each data.users as user (user.id)}
					<tr class="hover:bg-slate-700/30">
						<td class="px-4 py-3">
							<div class="flex items-center gap-3">
								<div class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700">
									<svg
										class="h-4 w-4 text-slate-400"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
										/>
									</svg>
								</div>
								<div>
									<div class="flex items-center gap-2">
										<p class="font-medium text-white">{user.username}</p>
										{#if !user.isLocal}
											<span
												class="flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400"
												title="SSO User"
											>
												<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
													/>
												</svg>
												SSO
											</span>
										{/if}
									</div>
									{#if user.email}
										<p class="text-xs text-slate-400">{user.email}</p>
									{/if}
								</div>
							</div>
						</td>
						<td class="px-4 py-3">
							<span
								class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium {getRoleBadgeColor(
									user.role
								)}"
							>
								{user.role}
							</span>
						</td>
						<td class="hidden px-4 py-3 md:table-cell">
							{#if user.active}
								<span class="inline-flex items-center gap-1.5 text-sm text-emerald-400">
									<CheckCircle2 size={14} />
									Active
								</span>
							{:else}
								<span class="inline-flex items-center gap-1.5 text-sm text-slate-400">
									<XCircle size={14} />
									Inactive
								</span>
							{/if}
						</td>
						<td class="hidden px-4 py-3 text-sm text-slate-400 sm:table-cell">
							{formatDate(user.createdAt)}
						</td>
						<td class="px-4 py-3">
							<div class="flex justify-end gap-2">
								{#if user.isLocal}
									<Button
										variant="ghost"
										size="sm"
										onclick={() => openResetPasswordModal(user)}
										title="Reset Password"
									>
										<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
											/>
										</svg>
									</Button>
								{/if}
								<Button variant="ghost" size="sm" onclick={() => openEditModal(user)} title="Edit">
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
										/>
									</svg>
								</Button>
								{#if user.id !== data.currentUser.id}
									<Button
										variant="ghost"
										size="sm"
										onclick={() => openDeleteModal(user)}
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
								{/if}
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<!-- Pagination -->
		<Pagination total={data.total} limit={data.limit} offset={data.offset} onPageChange={handlePageChange} />
	</div>

	<!-- Create User Modal -->
	{#if showCreateModal}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			aria-labelledby="create-user-title"
			onclick={(e) => e.target === e.currentTarget && closeModals()}
			onkeydown={(e) => e.key === 'Escape' && closeModals()}
		>
			<div
				class="h-full w-full overflow-y-auto border border-slate-700 bg-slate-800 p-6 shadow-2xl sm:h-auto sm:max-w-md sm:rounded-xl"
			>
				<h2 id="create-user-title" class="mb-4 text-xl font-bold text-white">Create New User</h2>

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
						<label for="username" class="mb-1 block text-sm font-medium text-slate-300"
							>Username</label
						>
						<input
							type="text"
							id="username"
							name="username"
							bind:value={newUser.username}
							required
							minlength="3"
							class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-amber-500 focus:outline-none"
							placeholder="Enter username"
						/>
					</div>

					<div>
						<label for="email" class="mb-1 block text-sm font-medium text-slate-300"
							>Email (optional)</label
						>
						<input
							type="email"
							id="email"
							name="email"
							bind:value={newUser.email}
							class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-amber-500 focus:outline-none"
							placeholder="user@example.com"
						/>
					</div>

					<div>
						<label for="role" class="mb-1 block text-sm font-medium text-slate-300">Role</label>
						<select
							id="role"
							name="role"
							bind:value={newUser.role}
							required
							class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
						>
							<option value="viewer">Viewer (read-only)</option>
							<option value="editor">Editor (can modify resources)</option>
							<option value="admin">Admin (full access)</option>
						</select>
					</div>

					<div>
						<label for="password" class="mb-1 block text-sm font-medium text-slate-300"
							>Password</label
						>
						<div class="flex gap-2">
							<input
								type="text"
								id="password"
								name="password"
								bind:value={newUser.password}
								required
								minlength="8"
								class="flex-1 rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 font-mono text-sm text-white focus:border-amber-500 focus:outline-none"
							/>
							<Button
								type="button"
								variant="secondary"
								onclick={() => (newUser.password = generatePassword())}
							>
								Regenerate
							</Button>
						</div>
						<p class="mt-1 text-xs text-slate-400">Auto-generated password shown above</p>
					</div>

					<div class="flex justify-end gap-3 pt-4">
						<Button type="button" variant="ghost" onclick={closeModals}>Cancel</Button>
						<Button
							type="submit"
							class="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 hover:from-amber-400 hover:to-amber-500"
						>
							Create User
						</Button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- Edit User Modal -->
	{#if editingUser}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			aria-labelledby="edit-user-title"
			onclick={(e) => e.target === e.currentTarget && closeModals()}
			onkeydown={(e) => e.key === 'Escape' && closeModals()}
		>
			<div
				class="h-full w-full overflow-y-auto border border-slate-700 bg-slate-800 p-6 shadow-2xl sm:h-auto sm:max-w-md sm:rounded-xl"
			>
				<h2 id="edit-user-title" class="mb-4 text-xl font-bold text-white">
					Edit User: {editingUser.username}
				</h2>

				<form
					method="POST"
					action="?/update"
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
					<input type="hidden" name="userId" value={editingUser.id} />

					<div>
						<label for="editEmail" class="mb-1 block text-sm font-medium text-slate-300"
							>Email</label
						>
						<input
							type="email"
							id="editEmail"
							name="email"
							value={editingUser.email || ''}
							class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-amber-500 focus:outline-none"
							placeholder="user@example.com"
						/>
					</div>

					<div>
						<label for="editRole" class="mb-1 block text-sm font-medium text-slate-300">Role</label>
						<select
							id="editRole"
							name="role"
							value={editingUser.role}
							class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
						>
							<option value="viewer">Viewer (read-only)</option>
							<option value="editor">Editor (can modify resources)</option>
							<option value="admin">Admin (full access)</option>
						</select>
					</div>

					<div class="flex items-center gap-2">
						<input
							type="checkbox"
							name="active"
							value="true"
							checked={editingUser.active}
							id="active"
							class="rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
						/>
						<label for="active" class="text-sm text-slate-300">Active</label>
					</div>

					<div class="flex justify-end gap-3 pt-4">
						<Button type="button" variant="ghost" onclick={closeModals}>Cancel</Button>
						<Button
							type="submit"
							class="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 hover:from-amber-400 hover:to-amber-500"
						>
							Save Changes
						</Button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- Delete Confirmation Modal -->
	{#if deletingUser}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			aria-labelledby="delete-user-title"
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
				<h2 id="delete-user-title" class="mb-2 text-xl font-bold text-white">Delete User</h2>
				<p class="mb-6 text-slate-400">
					Are you sure you want to delete <strong class="text-white">{deletingUser.username}</strong
					>? This action cannot be undone.
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
					<input type="hidden" name="userId" value={deletingUser.id} />
					<input type="hidden" name="username" value={deletingUser.username} />
					<Button type="button" variant="ghost" onclick={closeModals}>Cancel</Button>
					<Button type="submit" variant="destructive">Delete User</Button>
				</form>
			</div>
		</div>
	{/if}

	<!-- Reset Password Modal -->
	{#if resettingPassword}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div class="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-2xl">
				<h2 class="mb-4 text-xl font-bold text-white">Reset Password</h2>
				<p class="mb-4 text-slate-400">
					Generate a new password for <strong class="text-white"
						>{resettingPassword.username}</strong
					>
				</p>

				<form
					method="POST"
					action="?/resetPassword"
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
					<input type="hidden" name="userId" value={resettingPassword.id} />

					<div>
						<label for="newPassword" class="mb-1 block text-sm font-medium text-slate-300"
							>New Password</label
						>
						<div class="flex gap-2">
							<input
								type="text"
								id="newPassword"
								name="newPassword"
								bind:value={generatedPassword}
								required
								minlength="8"
								class="flex-1 rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 font-mono text-sm text-white focus:border-amber-500 focus:outline-none"
							/>
							<Button
								type="button"
								variant="secondary"
								onclick={() => (generatedPassword = generatePassword())}
							>
								Regenerate
							</Button>
						</div>
					</div>

					<p class="text-xs text-amber-400">
						The password will be displayed after reset. Copy it immediately - it won't be shown
						again.
					</p>

					<div class="flex justify-end gap-3 pt-4">
						<Button type="button" variant="ghost" onclick={closeModals}>Cancel</Button>
						<Button
							type="submit"
							class="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 hover:from-amber-400 hover:to-amber-500"
						>
							Reset Password
						</Button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>
