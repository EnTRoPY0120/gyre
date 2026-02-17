<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import {
		Download,
		Trash2,
		Plus,
		Upload,
		HardDrive,
		AlertTriangle,
		Loader2
	} from 'lucide-svelte';
	import { formatDistanceToNow } from 'date-fns';
	import Icon from '$lib/components/ui/Icon.svelte';

	interface BackupMetadata {
		filename: string;
		sizeBytes: number;
		createdAt: string;
	}

	let { data } = $props<{
		data: { backups: BackupMetadata[] };
	}>();

	let creating = $state(false);
	let restoring = $state(false);
	let deletingFilename = $state<string | null>(null);
	let showRestoreConfirm = $state(false);
	let restoreFile = $state<File | null>(null);

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
	}

	function formatTimestamp(dateStr: string): string {
		return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
	}

	async function createBackup() {
		creating = true;
		try {
			const response = await fetch('/api/admin/backups', { method: 'POST' });
			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.message || 'Failed to create backup');
			}
			const result = await response.json();
			toast.success(`Backup created: ${result.backup.filename}`);
			await invalidateAll();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to create backup');
		} finally {
			creating = false;
		}
	}

	async function downloadBackup(filename: string) {
		try {
			const response = await fetch(
				`/api/admin/backups/download?filename=${encodeURIComponent(filename)}`
			);
			if (!response.ok) {
				throw new Error('Failed to download backup');
			}
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			toast.success('Download started');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to download backup');
		}
	}

	async function deleteBackupFile(filename: string) {
		deletingFilename = filename;
		try {
			const response = await fetch(
				`/api/admin/backups?filename=${encodeURIComponent(filename)}`,
				{ method: 'DELETE' }
			);
			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.message || 'Failed to delete backup');
			}
			toast.success('Backup deleted');
			await invalidateAll();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to delete backup');
		} finally {
			deletingFilename = null;
		}
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			restoreFile = input.files[0];
			showRestoreConfirm = true;
		}
	}

	async function confirmRestore() {
		if (!restoreFile) return;

		restoring = true;
		try {
			const formData = new FormData();
			formData.append('file', restoreFile);

			const response = await fetch('/api/admin/backups/restore', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.message || 'Failed to restore backup');
			}

			const result = await response.json();
			toast.success(result.message);
			showRestoreConfirm = false;
			restoreFile = null;
			await invalidateAll();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to restore backup');
		} finally {
			restoring = false;
		}
	}

	function cancelRestore() {
		showRestoreConfirm = false;
		restoreFile = null;
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
		<div>
			<h1 class="text-2xl font-bold text-white">Database Backups</h1>
			<p class="text-slate-400">Create, download, and restore SQLite database backups</p>
		</div>
		<div class="flex gap-2">
			<button
				onclick={createBackup}
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
			<label
				class="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700/50"
			>
				<Upload size={16} />
				Restore
				<input
					type="file"
					accept=".db,.sqlite,.sqlite3"
					class="hidden"
					onchange={handleFileSelect}
				/>
			</label>
		</div>
	</div>

	<!-- Restore Confirmation Modal -->
	{#if showRestoreConfirm}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
			role="dialog"
			aria-modal="true"
			aria-labelledby="restore-modal-title"
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
					{#if restoreFile}
						<div
							class="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm"
						>
							<HardDrive size={14} class="text-slate-400" />
							<span class="font-mono text-slate-300">{restoreFile.name}</span>
							<span class="ml-auto text-slate-500">{formatBytes(restoreFile.size)}</span>
						</div>
					{/if}
					<p class="text-xs text-slate-500">
						The application may need to be restarted after restore for changes to take full effect.
					</p>
				</div>
				<div class="flex justify-end gap-3">
					<button
						onclick={cancelRestore}
						disabled={restoring}
						class="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700/50 disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						onclick={confirmRestore}
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

	<!-- Backups Table -->
	<div class="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50">
		<div class="overflow-x-auto">
			<table class="w-full text-left text-sm">
				<thead>
					<tr class="border-b border-slate-700/50 bg-slate-900/30">
						<th class="px-4 py-3 font-medium text-slate-400">Filename</th>
						<th class="px-4 py-3 font-medium text-slate-400">Size</th>
						<th class="px-4 py-3 font-medium text-slate-400">Created</th>
						<th class="px-4 py-3 text-right font-medium text-slate-400">Actions</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-700/50">
					{#each data.backups as backup (backup.filename)}
						<tr class="transition-colors hover:bg-slate-700/30">
							<td class="px-4 py-3">
								<div class="flex items-center gap-2">
									<HardDrive size={14} class="text-slate-500" />
									<span class="font-mono text-sm text-white">{backup.filename}</span>
								</div>
							</td>
							<td class="px-4 py-3">
								<span class="text-slate-300">{formatBytes(backup.sizeBytes)}</span>
							</td>
							<td class="px-4 py-3">
								<div class="flex flex-col">
									<span class="text-slate-300"
										>{new Date(backup.createdAt).toLocaleString()}</span
									>
									<span class="text-[10px] text-slate-500 uppercase"
										>{formatTimestamp(backup.createdAt)}</span
									>
								</div>
							</td>
							<td class="px-4 py-3">
								<div class="flex items-center justify-end gap-1">
									<button
										onclick={() => downloadBackup(backup.filename)}
										class="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700/50 hover:text-amber-400"
										aria-label={`Download ${backup.filename}`}
										title="Download"
									>
										<Download size={16} />
									</button>
									<button
										onclick={() => deleteBackupFile(backup.filename)}
										disabled={deletingFilename === backup.filename}
										class="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
										aria-label={`Delete ${backup.filename}`}
										title="Delete"
									>
										{#if deletingFilename === backup.filename}
											<Loader2 size={16} class="animate-spin" />
										{:else}
											<Trash2 size={16} />
										{/if}
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if data.backups.length === 0}
			<div class="flex flex-col items-center justify-center py-20 text-slate-500">
				<Icon name="database" size={48} class="mb-4 opacity-20" />
				<p class="mb-1 font-medium text-slate-400">No backups yet</p>
				<p class="text-sm">Create your first backup to get started</p>
			</div>
		{/if}
	</div>

	<!-- Info Cards -->
	<div class="grid gap-6 md:grid-cols-2">
		<div
			class="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-900/20"
		>
			<h3 class="font-semibold text-blue-900 dark:text-blue-100">On-Demand Backups</h3>
			<p class="mt-2 text-sm text-blue-800 dark:text-blue-200">
				Create a snapshot of the current SQLite database at any time. Backups are stored locally and
				a maximum of 10 are retained. Older backups are automatically pruned.
			</p>
		</div>

		<div
			class="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-900 dark:bg-purple-900/20"
		>
			<h3 class="font-semibold text-purple-900 dark:text-purple-100">Restore from Backup</h3>
			<p class="mt-2 text-sm text-purple-800 dark:text-purple-200">
				Upload a previously downloaded backup file to restore the database. A safety backup is
				always created before restoring. The file must be a valid Gyre SQLite database.
			</p>
		</div>
	</div>
</div>
