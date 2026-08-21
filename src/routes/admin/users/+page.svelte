<script lang="ts">
	import { goto } from '$app/navigation';
	import { buildAdminPageUrl, buildAdminSearchUrl } from '$lib/admin/navigation';
	import Button from '$lib/components/ui/button/button.svelte';
	import UserTable from '$lib/components/admin/UserTable.svelte';
	import UserCreateModal from '$lib/components/admin/UserCreateModal.svelte';
	import UserEditModal from '$lib/components/admin/UserEditModal.svelte';
	import UserDeleteDialog from '$lib/components/admin/UserDeleteDialog.svelte';
	import UserResetPasswordModal from '$lib/components/admin/UserResetPasswordModal.svelte';
	import type { NewUser, User } from '$lib/components/admin/user-types';
	import { UserPlus, AlertTriangle, CheckCircle2 } from '@lucide/svelte';
	import SearchBar from '$lib/components/ui/search/SearchBar.svelte';
	import Pagination from '$lib/components/ui/pagination/Pagination.svelte';
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

	let newUser = $state<NewUser>({
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
		<UserCreateModal
			bind:newUser
			passwordPattern={PASSWORD_PATTERN}
			passwordTitle={PASSWORD_TITLE}
			onClose={closeModals}
			onGeneratePassword={generatePassword}
		/>
	{/if}

	<!-- Edit User Modal -->
	{#if editingUser}
		<UserEditModal user={editingUser} onClose={closeModals} />
	{/if}

	<!-- Delete Confirmation Modal -->
	{#if deletingUser}
		<UserDeleteDialog user={deletingUser} onClose={closeModals} />
	{/if}

	<!-- Reset Password Modal -->
	{#if resettingPassword}
		<UserResetPasswordModal
			user={resettingPassword}
			bind:generatedPassword
			bind:passwordResetSuccess
			passwordPattern={PASSWORD_PATTERN}
			passwordTitle={PASSWORD_TITLE}
			onClose={closeModals}
			onGeneratePassword={generatePassword}
		/>
	{/if}
</div>
