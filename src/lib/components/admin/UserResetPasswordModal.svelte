<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { CheckCircle2 } from '@lucide/svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { getCsrfToken } from '$lib/utils/csrf';
	import type { User } from './user-types';

	let {
		user,
		generatedPassword = $bindable(''),
		passwordResetSuccess = $bindable(false),
		passwordPattern,
		passwordTitle,
		onClose,
		onGeneratePassword
	}: {
		user: User;
		generatedPassword: string;
		passwordResetSuccess: boolean;
		passwordPattern: string;
		passwordTitle: string;
		onClose: () => void;
		onGeneratePassword: () => string;
	} = $props();
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
	role="dialog"
	aria-modal="true"
	tabindex="-1"
	aria-labelledby="reset-password-title"
	aria-describedby={passwordResetSuccess
		? 'reset-password-success-message reset-password-generated-password reset-password-success-hint'
		: 'reset-password-description new-password-hint reset-password-warning'}
	onclick={(e) => e.target === e.currentTarget && onClose()}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
>
	<div class="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-2xl">
		<h2 id="reset-password-title" class="mb-4 text-xl font-bold text-white">Reset Password</h2>
		<p id="reset-password-description" class="mb-4 text-slate-400">
			Generate a new password for <strong class="text-white">{user.username}</strong>
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
					<Button type="button" onclick={onClose}>Done</Button>
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
				<input type="hidden" name="userId" value={user.id} />

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
							pattern={passwordPattern}
							title={passwordTitle}
							aria-describedby="new-password-hint"
							class="flex-1 rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 font-mono text-sm text-white focus:border-amber-500 focus:outline-none"
						/>
						<Button type="button" variant="secondary" onclick={() => (generatedPassword = onGeneratePassword())}>
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
					<Button type="button" variant="ghost" onclick={onClose}>Cancel</Button>
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
