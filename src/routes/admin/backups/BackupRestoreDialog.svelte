<script lang="ts">
	import { AlertTriangle, HardDrive, Loader2 } from '@lucide/svelte';
	import { modalFocusTrap } from '$lib/utils/focus-trap';

	let {
		open,
		file,
		restoring,
		onCancel,
		onConfirm,
		formatBytes
	}: {
		open: boolean;
		file: File | null;
		restoring: boolean;
		onCancel: () => void;
		onConfirm: () => void;
		formatBytes: (bytes: number) => string;
	} = $props();

	let modalContainer = $state<HTMLElement | null>(null);

	$effect(() => {
		if (!open) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && !restoring) onCancel();
		};

		window.addEventListener('keydown', handleKeyDown);

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	});
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="restore-modal-title"
		bind:this={modalContainer}
		use:modalFocusTrap
	>
		<div
			class="mx-4 w-full max-w-md rounded-2xl border border-slate-700/50 bg-slate-800 p-6 shadow-2xl"
		>
			<div class="mb-4 flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-500"
				>
					<AlertTriangle size={20} />
				</div>
				<h2 id="restore-modal-title" class="text-lg font-bold text-white">
					Confirm Database Restore
				</h2>
			</div>
			<div class="mb-6 space-y-3">
				<p class="text-sm text-slate-300">
					This will <strong class="text-amber-400">replace the current database</strong> with the
					uploaded file. A safety backup will be created automatically before restoring.
				</p>
				{#if file}
					<div
						class="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm"
					>
						<HardDrive size={14} class="text-slate-400" />
						<span class="font-mono text-slate-300">{file.name}</span>
						<span class="ml-auto text-slate-500">{formatBytes(file.size)}</span>
					</div>
				{/if}
				<p class="text-xs text-slate-500">
					The application may need to be restarted after restore for changes to take full effect.
				</p>
			</div>
			<div class="flex justify-end gap-3">
				<button
					type="button"
					onclick={onCancel}
					disabled={restoring}
					class="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700/50 disabled:opacity-50"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={onConfirm}
					disabled={restoring}
					class="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if restoring}
						<Loader2 size={14} class="animate-spin" />
						Restoring...
					{:else}
						Restore Database
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
