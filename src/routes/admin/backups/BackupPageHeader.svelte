<script lang="ts">
	import { Loader2, Plus, Upload } from '@lucide/svelte';

	let {
		creating,
		onCreate,
		onRestore
	}: {
		creating: boolean;
		onCreate: () => void;
		onRestore: () => void;
	} = $props();
</script>

<div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
	<div>
		<h1 class="text-2xl font-bold text-white">Database Backups</h1>
		<p class="text-slate-400">Create, download, and restore SQLite database backups</p>
	</div>
	<div class="flex gap-2">
		<button
			type="button"
			onclick={onCreate}
			disabled={creating}
			class="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
		>
			{#if creating}
				<Loader2 size={16} class="animate-spin" />
				Creating...
			{:else}
				<Plus size={16} />
				Create Backup
			{/if}
		</button>
		<button
			type="button"
			onclick={onRestore}
			class="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700/50"
		>
			<Upload size={16} />
			Restore
		</button>
	</div>
</div>
