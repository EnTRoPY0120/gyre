<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import { invalidateAll, goto } from '$app/navigation';
	import { buildAdminPageUrl, buildAdminSearchUrl } from '$lib/admin/navigation';
	import { getCsrfToken } from '$lib/utils/csrf';
	import Button from '$lib/components/ui/button/button.svelte';
	import AdminConfirmDialog from '$lib/components/admin/AdminConfirmDialog.svelte';
	import UserTable from '$lib/components/admin/UserTable.svelte';
	import type { User } from '$lib/components/admin/user-types';
	import { UserPlus, AlertTriangle, CheckCircle2 } from '@lucide/svelte';
	import SearchBar from '$lib/components/ui/search/SearchBar.svelte';
	import Pagination from '$lib/components/ui/pagination/Pagination.svelte';
	import * as Select from '$lib/components/ui/select';

	let { data, form } = $props<{
		data: {
			users: User[];
			currentUser: User;
			total: number;
			search: string;
			limit: number;
			offset: number;
		};
		form?: { error?: string; success?: boolean };
	}>();

	let showCreateModal = $state(false);
	let editingUser = $state<User | null>(null);
	let deletingUser = $state<User | null>(null);
	let resettingPassword = $state<User | null>(null);
	let generatedPassword = $state('');
	let passwordResetSuccess = $state(false);
	let searchValue = $state('');

	// Sync searchValue with data.search changes (e.g., back/forward navigation)
	$effect.pre(() => {
		searchValue = data.search;
	});

	let newUser = $state({
		username: '',
		email: '',
		role: 'viewer' as 'admin' | 'editor' | 'viewer',
		password: ''
	});

	function handleSearch(value: string) {
		searchValue = value;
		goto(buildAdminSearchUrl(value));
	}

	function handlePageChange(newOffset: number) {
		goto(buildAdminPageUrl(newOffset));
	}

	// Must stay in sync with passwordSchema in $lib/utils/validation.ts
	const PASSWORD_PATTERN =
		'(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}';
	const PASSWORD_TITLE =
		'At least 8 characters with one uppercase, one lowercase, one number, and one special character (!@#$%^&*(),.?":{}|<>)';

	function generatePassword() {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
		const values = new Uint32Array(12);
		crypto.getRandomValues(values);
		return Array.from(values, (v) => chars[v % chars.length]).join('');
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
		passwordResetSuccess = false;
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
		</div>
	{/if}

	<!-- Users Table -->
	<div class="rounded-xl border border-slate-700/50 bg-slate-800/50">
		<UserTable
			users={data.users}
			currentUserId={data.currentUser.id}
			{getRoleBadgeColor}
			{formatDate}
			onResetPassword={openResetPasswordModal}
			onEdit={openEditModal}
			onDelete={openDeleteModal}
		/>

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
							} else {
								await applyAction(result);
							}
						};
					}}
					class="space-y-4"
				>
					<input type="hidden" name="_csrf" value={getCsrfToken()} />
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
						<Select.Root
							type="single"
							value={newUser.role}
							onValueChange={(v) => (newUser.role = v as 'admin' | 'editor' | 'viewer')}
						>
							<Select.Trigger id="role" class="w-full">
								<Select.Value placeholder="Select Role">
									<span class="capitalize">{newUser.role}</span>
								</Select.Value>
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="viewer">Viewer (read-only)</Select.Item>
								<Select.Item value="editor">Editor (can modify resources)</Select.Item>
								<Select.Item value="admin">Admin (full access)</Select.Item>
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="role" value={newUser.role} />
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
								pattern={PASSWORD_PATTERN}
								title={PASSWORD_TITLE}
								aria-describedby="password-hint"
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
						<p id="password-hint" class="mt-1 text-xs text-slate-400">
							Min 8 characters · one uppercase · one lowercase · one number · one special character
						</p>
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
							} else {
								await applyAction(result);
							}
						};
					}}
					class="space-y-4"
				>
					<input type="hidden" name="_csrf" value={getCsrfToken()} />
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
						<Select.Root
							type="single"
							value={editingUser.role}
							onValueChange={(v) => (editingUser!.role = v as 'admin' | 'editor' | 'viewer')}
						>
							<Select.Trigger id="editRole" class="w-full">
								<Select.Value placeholder="Select Role">
									<span class="capitalize">{editingUser.role}</span>
								</Select.Value>
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="viewer">Viewer (read-only)</Select.Item>
								<Select.Item value="editor">Editor (can modify resources)</Select.Item>
								<Select.Item value="admin">Admin (full access)</Select.Item>
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="role" value={editingUser.role} />
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
						<input type="hidden" name="active" value="false" />
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
		<AdminConfirmDialog title="Delete User" titleId="delete-user-title" onClose={closeModals}>
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
							} else {
								await applyAction(result);
							}
						};
					}}
					class="flex justify-end gap-3"
				>
					<input type="hidden" name="_csrf" value={getCsrfToken()} />
					<input type="hidden" name="userId" value={deletingUser.id} />
					<input type="hidden" name="username" value={deletingUser.username} />
					<Button type="button" variant="ghost" onclick={closeModals}>Cancel</Button>
					<Button type="submit" variant="destructive">Delete User</Button>
				</form>
		</AdminConfirmDialog>
	{/if}

	<!-- Reset Password Modal -->
	{#if resettingPassword}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			aria-labelledby="reset-password-title"
			aria-describedby={passwordResetSuccess
				? 'reset-password-success-message reset-password-generated-password reset-password-success-hint'
				: 'reset-password-description new-password-hint reset-password-warning'}
			onclick={(e) => e.target === e.currentTarget && closeModals()}
			onkeydown={(e) => e.key === 'Escape' && closeModals()}
		>
			<div class="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-2xl">
				<h2 id="reset-password-title" class="mb-4 text-xl font-bold text-white">Reset Password</h2>
				<p id="reset-password-description" class="mb-4 text-slate-400">
					Generate a new password for <strong class="text-white"
						>{resettingPassword.username}</strong
					>
				</p>

				{#if passwordResetSuccess}
				<div class="space-y-4">
					<div
						id="reset-password-success-message"
						class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-400"
					>
						<div class="flex items-center gap-2">
							<CheckCircle2 size={16} />
							Password reset successfully
						</div>
					</div>
					<div id="reset-password-generated-password" class="rounded bg-slate-900 p-3">
						<p class="text-xs text-slate-400">New Password:</p>
						<p class="font-mono text-sm text-amber-400">{generatedPassword}</p>
						<p id="reset-password-success-hint" class="mt-1 text-xs text-slate-500">
							Copy this now - it won't be shown again
						</p>
					</div>
					<div class="flex justify-end pt-2">
						<Button type="button" onclick={closeModals}>Done</Button>
					</div>
				</div>
			{:else}
				<form
					method="POST"
					action="?/resetPassword"
					use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'success') {
								passwordResetSuccess = true;
								invalidateAll();
							} else {
								await applyAction(result);
							}
						};
					}}
					class="space-y-4"
				>
					<input type="hidden" name="_csrf" value={getCsrfToken()} />
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
								pattern={PASSWORD_PATTERN}
								title={PASSWORD_TITLE}
								aria-describedby="new-password-hint"
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
						<p id="new-password-hint" class="mt-1 text-xs text-slate-400">
							Min 8 characters · one uppercase · one lowercase · one number · one special character
						</p>
					</div>

					<p id="reset-password-warning" class="text-xs text-amber-400">
						Copy the password before submitting - it will only be shown once after reset.
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
			{/if}
			</div>
		</div>
	{/if}
</div>
