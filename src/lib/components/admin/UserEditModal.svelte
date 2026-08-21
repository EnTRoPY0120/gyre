<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Select from '$lib/components/ui/select';
	import { getCsrfToken } from '$lib/utils/csrf';
	import type { User } from './user-types';

	let { user, onClose }: { user: User; onClose: () => void } = $props();
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4"
	role="dialog"
	aria-modal="true"
	tabindex="-1"
	aria-labelledby="edit-user-title"
	onclick={(e) => e.target === e.currentTarget && onClose()}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
>
	<div
		class="h-full w-full overflow-y-auto border border-slate-700 bg-slate-800 p-6 shadow-2xl sm:h-auto sm:max-w-md sm:rounded-xl"
	>
		<h2 id="edit-user-title" class="mb-4 text-xl font-bold text-white">Edit User: {user.username}</h2>

		<form
			method="POST"
			action="?/update"
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
			<input type="hidden" name="userId" value={user.id} />

			<div>
				<label for="editEmail" class="mb-1 block text-sm font-medium text-slate-300">Email</label>
				<input
					type="email"
					id="editEmail"
					name="email"
					value={user.email || ''}
					class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-amber-500 focus:outline-none"
					placeholder="user@example.com"
				/>
			</div>

			<div>
				<label for="editRole" class="mb-1 block text-sm font-medium text-slate-300">Role</label>
				<Select.Root
					type="single"
					value={user.role}
					onValueChange={(value) => (user.role = value as User['role'])}
				>
					<Select.Trigger id="editRole" class="w-full">
						<Select.Value placeholder="Select Role">
							<span class="capitalize">{user.role}</span>
						</Select.Value>
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="viewer">Viewer (read-only)</Select.Item>
						<Select.Item value="editor">Editor (can modify resources)</Select.Item>
						<Select.Item value="admin">Admin (full access)</Select.Item>
					</Select.Content>
				</Select.Root>
				<input type="hidden" name="role" value={user.role} />
			</div>

			<div class="flex items-center gap-2">
				<input
					type="checkbox"
					name="active"
					value="true"
					checked={user.active}
					id="active"
					class="rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
				/>
				<input type="hidden" name="active" value="false" />
				<label for="active" class="text-sm text-slate-300">Active</label>
			</div>

			<div class="flex justify-end gap-3 pt-4">
				<Button type="button" variant="ghost" onclick={onClose}>Cancel</Button>
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
