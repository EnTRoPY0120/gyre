<script lang="ts">
	import { Save } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';

	let {
		validationErrorCount,
		saving,
		onClose,
		onSave
	}: {
		validationErrorCount: number;
		saving: boolean;
		onClose: () => void;
		onSave: () => void;
	} = $props();
</script>

<div class="flex items-center justify-between border-t border-zinc-700 bg-zinc-900/50 p-4 md:p-6">
	<div class="text-xs text-zinc-500">
		{#if validationErrorCount > 0}
			<span class="text-red-400">
				{validationErrorCount} error{validationErrorCount !== 1 ? 's' : ''} found
			</span>
		{:else}
			Press <kbd class="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5">Ctrl+S</kbd> to save
		{/if}
	</div>
	<div class="flex gap-3">
		<Button
			variant="outline"
			onclick={onClose}
			disabled={saving}
			class="border-zinc-600 hover:bg-zinc-700"
		>
			Cancel
		</Button>
		<Button
			onclick={onSave}
			disabled={saving || validationErrorCount > 0}
			class="bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700"
		>
			{#if saving}
				<div class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
				Saving...
			{:else}
				<Save size={16} class="mr-2" />
				Save Changes
			{/if}
		</Button>
	</div>
</div>

<style>
	kbd {
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
	}
</style>
