<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Button from '$lib/components/ui/button/button.svelte';
	import { getCsrfToken } from '$lib/utils/csrf';

	let {
		activeClusterId,
		onClose
	}: {
		activeClusterId: string | null;
		onClose: () => void;
	} = $props();
</script>

<div class="mt-6 flex flex-col gap-3 border-t border-slate-700/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
	<form
		id="health-check-retest-form"
		method="POST"
		action="?/test"
		use:enhance={() => {
			return async ({ result, update }) => {
				await update();
				if (result.type === 'success' || result.type === 'failure') await invalidateAll();
			};
		}}
		class="flex"
	>
		<input type="hidden" name="_csrf" value={getCsrfToken()} />
		<input type="hidden" name="clusterId" value={activeClusterId ?? ''} />
		<Button type="submit" disabled={!activeClusterId}>Retest connection</Button>
	</form>
	<Button type="button" variant="ghost" onclick={onClose}>Back to Clusters</Button>
</div>
