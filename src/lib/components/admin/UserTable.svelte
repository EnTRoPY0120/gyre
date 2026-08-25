<script lang="ts">
	import { CheckCircle2, XCircle } from '@lucide/svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import type { User } from './user-types';

	let {
		users,
		currentUserId,
		getRoleBadgeColor,
		formatDate,
		onResetPassword,
		onEdit,
		onDelete
	}: {
		users: User[];
		currentUserId: string;
		getRoleBadgeColor: (role: string) => string;
		formatDate: (date: Date) => string;
		onResetPassword: (user: User) => void;
		onEdit: (user: User) => void;
		onDelete: (user: User) => void;
	} = $props();
</script>

<table class="w-full">
	<thead>
		<tr class="border-b border-slate-700/50">
			<th class="px-4 py-3 text-left text-sm font-medium text-slate-400">User</th>
			<th class="px-4 py-3 text-left text-sm font-medium text-slate-400">Role</th>
			<th class="hidden px-4 py-3 text-left text-sm font-medium text-slate-400 md:table-cell">Status</th>
			<th class="hidden px-4 py-3 text-left text-sm font-medium text-slate-400 sm:table-cell">Created</th>
			<th class="px-4 py-3 text-right text-sm font-medium text-slate-400">Actions</th>
		</tr>
	</thead>
	<tbody class="divide-y divide-slate-700/50">
		{#each users as user (user.id)}
			<tr class="hover:bg-slate-700/30">
				<td class="px-4 py-3">
					<div class="flex items-center gap-3">
						<div class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700">
							<svg class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
						class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium {getRoleBadgeColor(user.role)}"
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
				<td class="hidden px-4 py-3 text-sm text-slate-400 sm:table-cell">{formatDate(user.createdAt)}</td>
				<td class="px-4 py-3">
					<div class="flex justify-end gap-2">
						{#if user.isLocal}
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onclick={() => onResetPassword(user)}
								title="Reset Password"
								aria-label={`Reset password for ${user.username}`}
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
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onclick={() => onEdit(user)}
							title="Edit"
							aria-label={`Edit user ${user.username}`}
						>
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
								/>
							</svg>
						</Button>
						{#if user.id !== currentUserId}
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onclick={() => onDelete(user)}
								class="text-red-400 hover:text-red-300"
								title="Delete"
								aria-label={`Delete user ${user.username}`}
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
