<script lang="ts">
	let {
		loading,
		isCreate,
		roleMappingError,
		onClose
	}: {
		loading: boolean;
		isCreate: boolean;
		roleMappingError: string;
		onClose: () => void;
	} = $props();
</script>

<div class="flex gap-3 pt-4">
	<button
		type="submit"
		disabled={loading || !!roleMappingError}
		class="flex-1 rounded-lg bg-amber-500 px-4 py-2 font-medium text-slate-900 transition-colors hover:bg-amber-400 disabled:opacity-50"
	>
		{loading ? (isCreate ? 'Creating...' : 'Updating...') : isCreate ? 'Create Provider' : 'Update Provider'}
	</button>
	<button
		type="button"
		onclick={onClose}
		class="rounded-lg border border-slate-600 px-4 py-2 text-slate-300 transition-colors hover:bg-slate-700"
	>
		Cancel
	</button>
</div>
