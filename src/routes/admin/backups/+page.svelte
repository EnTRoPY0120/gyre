<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import { formatDistanceToNow } from 'date-fns';
	import { getCsrfToken } from '$lib/utils/csrf';
	import BackupInfoCards from './BackupInfoCards.svelte';
	import BackupPageHeader from './BackupPageHeader.svelte';
	import BackupRestoreDialog from './BackupRestoreDialog.svelte';
	import BackupTable from './BackupTable.svelte';
	import type { BackupMetadata } from './backup-types';

	let { data } = $props<{
		data: { backups: BackupMetadata[] };
	}>();

	let creating = $state(false);
	let restoring = $state(false);
	let deletingFilename = $state<string | null>(null);
	let showRestoreConfirm = $state(false);
	let restoreFile = $state<File | null>(null);
	let restoreInput = $state<HTMLInputElement | null>(null);

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
			const response = await fetch('/api/v1/admin/backups', {
				method: 'POST',
				headers: { 'X-CSRF-Token': getCsrfToken() }
			});
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
				`/api/v1/admin/backups/download?filename=${encodeURIComponent(filename)}`
			);
			if (!response.ok) {
				throw new Error('Failed to download backup');
			}
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename.endsWith('.enc') ? filename.replace(/\.enc$/, '') : filename;
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
			const response = await fetch(`/api/v1/admin/backups?filename=${encodeURIComponent(filename)}`, {
				method: 'DELETE',
				headers: { 'X-CSRF-Token': getCsrfToken() }
			});
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

	async function requestBackupRestore(file: File): Promise<{ message: string }> {
		const formData = new FormData();
		formData.append('file', file);
		const response = await fetch('/api/v1/admin/backups/restore', {
			method: 'POST',
			headers: { 'X-CSRF-Token': getCsrfToken() },
			body: formData
		});

		if (!response.ok) {
			const err = await response.json();
			throw new Error(err.message || 'Failed to restore backup');
		}

		return response.json();
	}

	function handleRestoreClick() {
		restoreInput?.click();
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
			const result = await requestBackupRestore(restoreFile);
			toast.success(result.message);
			showRestoreConfirm = false;
			restoreFile = null;
			if (restoreInput) restoreInput.value = '';
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
		if (restoreInput) restoreInput.value = '';
	}
</script>

<div class="space-y-6">
	<BackupPageHeader creating={creating} onCreate={createBackup} onRestore={handleRestoreClick} />
	<input
		bind:this={restoreInput}
		type="file"
		accept=".db,.db.enc"
		class="hidden"
		onchange={handleFileSelect}
	/>
	<BackupRestoreDialog
		open={showRestoreConfirm}
		file={restoreFile}
		{restoring}
		onCancel={cancelRestore}
		onConfirm={confirmRestore}
		{formatBytes}
	/>
	<BackupTable
		backups={data.backups}
		{deletingFilename}
		{formatBytes}
		{formatTimestamp}
		onDownload={downloadBackup}
		onDelete={deleteBackupFile}
	/>
	<BackupInfoCards />
</div>
