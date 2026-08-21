<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import AdminConfirmDialog from '$lib/components/admin/AdminConfirmDialog.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { getCsrfToken } from '$lib/utils/csrf';
	import type { Policy } from './policy-types';

	let { policy, onClose }: { policy: Policy; onClose: () => void } = $props();
</script>

<AdminConfirmDialog title="Delete Policy" titleId="delete-policy-title" onClose={onClose}>
	<p class="mb-6 text-slate-400">
		Are you sure you want to delete <strong class="text-white">{policy.name}</strong>? This will remove
		the policy from all assigned users. This action cannot be undone.
	</p>

	<form
		method="POST"
		action="?/delete"
		use:enhance={() => {
			return async ({ result }) => {
				if (result.type === 'success') {
					onClose();
					invalidateAll();
				}
			};
		}}
		class="flex justify-end gap-3"
	>
		<input type="hidden" name="_csrf" value={getCsrfToken()} />
		<input type="hidden" name="policyId" value={policy.id} />
		<input type="hidden" name="policyName" value={policy.name} />
		<Button type="button" variant="ghost" onclick={onClose}>Cancel</Button>
		<Button type="submit" variant="destructive">Delete Policy</Button>
	</form>
</AdminConfirmDialog>
