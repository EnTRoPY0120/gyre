<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import AdminConfirmDialog from '$lib/components/admin/AdminConfirmDialog.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { getCsrfToken } from '$lib/utils/csrf';
	import type { User } from './user-types';

	let { user, onClose }: { user: User; onClose: () => void } = $props();
</script>

<AdminConfirmDialog title="Delete User" titleId="delete-user-title" onClose={onClose}>
	<p class="mb-6 text-slate-400">
		Are you sure you want to delete <strong class="text-white">{user.username}</strong>? This action
		cannot be undone.
	</p>

	<form
		method="POST"
		action="?/delete"
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
		class="flex justify-end gap-3"
	>
		<input type="hidden" name="_csrf" value={getCsrfToken()} />
		<input type="hidden" name="userId" value={user.id} />
		<input type="hidden" name="username" value={user.username} />
		<Button type="button" variant="ghost" onclick={onClose}>Cancel</Button>
		<Button type="submit" variant="destructive">Delete User</Button>
	</form>
</AdminConfirmDialog>
