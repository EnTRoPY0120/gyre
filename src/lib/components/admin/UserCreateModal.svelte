<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Select from '$lib/components/ui/select';
	import { getCsrfToken } from '$lib/utils/csrf';
	import type { NewUser } from './user-types';

	let {
		newUser = $bindable(),
		passwordPattern,
		passwordTitle,
		onClose,
		onGeneratePassword
	}: {
		newUser: NewUser;
		passwordPattern: string;
		passwordTitle: string;
		onClose: () => void;
		onGeneratePassword: () => string;
	} = $props();
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4"
	role="dialog"
	aria-modal="true"
	tabindex="-1"
	aria-labelledby="create-user-title"
	onclick={(e) => e.target === e.currentTarget && onClose()}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
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
						onClose();
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
				<label for="username" class="mb-1 block text-sm font-medium text-slate-300">Username</label>
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
				<label for="email" class="mb-1 block text-sm font-medium text-slate-300">Email (optional)</label>
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
					onValueChange={(value) => (newUser.role = value as NewUser['role'])}
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
				<label for="password" class="mb-1 block text-sm font-medium text-slate-300">Password</label>
				<div class="flex gap-2">
					<input
						type="text"
						id="password"
						name="password"
						bind:value={newUser.password}
						required
						minlength="8"
						pattern={passwordPattern}
						title={passwordTitle}
						aria-describedby="password-hint"
						class="flex-1 rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 font-mono text-sm text-white focus:border-amber-500 focus:outline-none"
					/>
					<Button type="button" variant="secondary" onclick={() => (newUser.password = onGeneratePassword())}>
						Regenerate
					</Button>
				</div>
				<p id="password-hint" class="mt-1 text-xs text-slate-400">
					Min 8 characters · one uppercase · one lowercase · one number · one special character
				</p>
			</div>

			<div class="flex justify-end gap-3 pt-4">
				<Button type="button" variant="ghost" onclick={onClose}>Cancel</Button>
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
