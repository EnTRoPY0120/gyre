<script lang="ts">
	import AdminConfirmDialog from '$lib/components/admin/AdminConfirmDialog.svelte';
	import type { AuthProviderSummary } from './auth-provider';

	let {
		provider,
		error,
		loading,
		onClose,
		onDelete
	}: {
		provider: AuthProviderSummary;
		error: string;
		loading: boolean;
		onClose: () => void;
		onDelete: () => void;
	} = $props();
</script>

<AdminConfirmDialog title="Delete Provider" titleId="delete-provider-title" onClose={onClose}>
	<p class="mb-6 text-slate-400">
		Are you sure you want to delete <strong class="text-white">{provider.name}</strong>? This action
		cannot be undone and will affect all users linked to this provider.
	</p>
	{#if error}
		<div class="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
			{error}
		</div>
	{/if}
	<div class="flex justify-end gap-3">
		<button
			type="button"
			onclick={onClose}
			class="rounded-lg border border-slate-600 px-4 py-2 text-slate-300 transition-colors hover:bg-slate-700"
		>
			Cancel
		</button>
		<button
			type="button"
			onclick={onDelete}
			disabled={loading}
			class="rounded-lg bg-red-500 px-4 py-2 font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
		>
			{loading ? 'Deleting...' : 'Delete'}
		</button>
	</div>
</AdminConfirmDialog>
