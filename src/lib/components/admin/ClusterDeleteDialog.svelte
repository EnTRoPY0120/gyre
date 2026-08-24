<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import AdminConfirmDialog from '$lib/components/admin/AdminConfirmDialog.svelte';
	import type { ClusterSummary } from '$lib/components/admin/cluster-types';
	import Button from '$lib/components/ui/button/button.svelte';
	import { getCsrfToken } from '$lib/utils/csrf';

	let {
		cluster,
		onClose
	}: {
		cluster: ClusterSummary;
		onClose: () => void;
	} = $props();
</script>

<AdminConfirmDialog title="Delete Cluster" titleId="delete-cluster-title" {onClose}>
	<p class="mb-6 text-slate-400">
		Are you sure you want to delete <strong class="text-white">{cluster.name}</strong>? This will remove
		the cluster configuration and all associated data. This action cannot be undone.
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
		<input type="hidden" name="clusterId" value={cluster.id} />
		<input type="hidden" name="clusterName" value={cluster.name} />
		<Button type="button" variant="ghost" onclick={onClose}>Cancel</Button>
		<Button type="submit" variant="destructive">Delete Cluster</Button>
	</form>
</AdminConfirmDialog>
