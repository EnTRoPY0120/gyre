<script lang="ts">
	import { X } from '@lucide/svelte';

	let {
		resourceType,
		namespace,
		name,
		saving,
		onClose
	}: {
		resourceType: string;
		namespace: string;
		name: string;
		saving: boolean;
		onClose: () => void;
	} = $props();
</script>

<div class="flex items-center justify-between border-b border-zinc-700 p-4 md:p-6">
	<div>
		<h2 id="edit-resource-title" class="text-xl font-semibold text-zinc-100">Edit Resource</h2>
		<p class="mt-1 text-sm text-zinc-400">{resourceType}/{namespace}/{name}</p>
	</div>
	<button
		onclick={onClose}
		disabled={saving}
		class="text-zinc-400 transition-colors hover:text-zinc-100 disabled:opacity-50"
		aria-label="Close modal"
	>
		<X size={24} />
	</button>
</div>
