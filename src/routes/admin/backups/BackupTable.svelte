<script lang="ts">
	import { Download, HardDrive, Lock, LockOpen, Loader2, Trash2 } from '@lucide/svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { BackupMetadata } from './backup-types';

	let {
		backups,
		deletingFilename,
		formatBytes,
		formatTimestamp,
		onDownload,
		onDelete
	}: {
		backups: BackupMetadata[];
		deletingFilename: string | null;
		formatBytes: (bytes: number) => string;
		formatTimestamp: (date: string) => string;
		onDownload: (filename: string) => void;
		onDelete: (filename: string) => void;
	} = $props();
</script>

<div class="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50">
	<div class="overflow-x-auto">
		<table class="w-full text-left text-sm">
			<thead>
				<tr class="border-b border-slate-700/50 bg-slate-900/30">
					<th class="px-4 py-3 font-medium text-slate-400">Filename</th>
					<th class="px-4 py-3 font-medium text-slate-400">Size</th>
					<th class="px-4 py-3 font-medium text-slate-400">Created</th>
					<th class="px-4 py-3 font-medium text-slate-400">Encryption</th>
					<th class="px-4 py-3 text-right font-medium text-slate-400">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-700/50">
				{#each backups as backup (backup.filename)}
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
								<span class="text-slate-300">{new Date(backup.createdAt).toLocaleString()}</span>
								<span class="text-[10px] text-slate-500 uppercase">
									{formatTimestamp(backup.createdAt)}
								</span>
							</div>
						</td>
						<td class="px-4 py-3">
							{#if backup.encrypted}
								<div class="flex items-center gap-1.5 text-emerald-400">
									<Lock size={13} />
									<span class="text-xs font-medium">AES-256-GCM</span>
								</div>
							{:else}
								<div class="flex items-center gap-1.5 text-amber-500">
									<LockOpen size={13} />
									<span class="text-xs font-medium">Unencrypted</span>
								</div>
							{/if}
						</td>
						<td class="px-4 py-3">
							<div class="flex items-center justify-end gap-1">
								<button
									type="button"
									onclick={() => onDownload(backup.filename)}
									class="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700/50 hover:text-amber-400"
									aria-label={`Download ${backup.filename}`}
									title="Download"
								>
									<Download size={16} />
								</button>
								<button
									type="button"
									onclick={() => onDelete(backup.filename)}
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

	{#if backups.length === 0}
		<div class="flex flex-col items-center justify-center py-20 text-slate-500">
			<Icon name="database" size={48} class="mb-4 opacity-20" />
			<p class="mb-1 font-medium text-slate-400">No backups yet</p>
			<p class="text-sm">Create your first backup to get started</p>
		</div>
	{/if}
</div>
