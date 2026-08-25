type BackupFetcher = typeof fetch;

interface BackupCreateResult {
	backup: { filename: string };
}

interface BackupRestoreResult {
	message: string;
}

async function getBackupErrorMessage(response: Response, fallback: string): Promise<string> {
	const data = await response.json().catch(() => null);
	const message = (data as { message?: unknown } | null)?.message;
	return typeof message === 'string' && message ? message : fallback;
}

export async function createBackupRequest(
	csrfToken: string,
	fetcher: BackupFetcher = fetch
): Promise<BackupCreateResult> {
	const response = await fetcher('/api/v1/admin/backups', {
		method: 'POST',
		headers: { 'X-CSRF-Token': csrfToken }
	});
	if (!response.ok) {
		throw new Error(await getBackupErrorMessage(response, 'Failed to create backup'));
	}

	return response.json();
}

export async function downloadBackupRequest(
	filename: string,
	fetcher: BackupFetcher = fetch
): Promise<Blob> {
	const response = await fetcher(
		`/api/v1/admin/backups/download?filename=${encodeURIComponent(filename)}`
	);
	if (!response.ok) throw new Error('Failed to download backup');

	return response.blob();
}

export async function deleteBackupRequest(
	filename: string,
	csrfToken: string,
	fetcher: BackupFetcher = fetch
): Promise<void> {
	const response = await fetcher(`/api/v1/admin/backups?filename=${encodeURIComponent(filename)}`, {
		method: 'DELETE',
		headers: { 'X-CSRF-Token': csrfToken }
	});
	if (!response.ok) {
		throw new Error(await getBackupErrorMessage(response, 'Failed to delete backup'));
	}
}

export async function restoreBackupRequest(
	file: File,
	csrfToken: string,
	fetcher: BackupFetcher = fetch
): Promise<BackupRestoreResult> {
	const formData = new FormData();
	formData.append('file', file);
	const response = await fetcher('/api/v1/admin/backups/restore', {
		method: 'POST',
		headers: { 'X-CSRF-Token': csrfToken },
		body: formData
	});
	if (!response.ok) {
		throw new Error(await getBackupErrorMessage(response, 'Failed to restore backup'));
	}

	return response.json();
}
