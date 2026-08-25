import { describe, expect, test, vi } from 'vitest';
import {
	createBackupRequest,
	deleteBackupRequest,
	downloadBackupRequest,
	getBackupRequestErrorMessage,
	restoreBackupRequest
} from '../routes/admin/backups/backup-requests.js';

describe('backup request policies', () => {
	test('uses known backup errors and safe fallbacks for unknown errors', () => {
		expect(getBackupRequestErrorMessage(new Error('restore failed'), 'fallback')).toBe(
			'restore failed'
		);
		expect(getBackupRequestErrorMessage('restore failed', 'fallback')).toBe('fallback');
	});

	test('creates a backup with the CSRF token', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify({ backup: { filename: 'backup.db' } })));

		await expect(createBackupRequest('csrf-token', fetcher)).resolves.toEqual({
			backup: { filename: 'backup.db' }
		});
		expect(fetcher).toHaveBeenCalledWith('/api/v1/admin/backups', {
			method: 'POST',
			headers: { 'X-CSRF-Token': 'csrf-token' }
		});
	});

	test('downloads an encoded backup filename', async () => {
		const body = new Blob(['backup']);
		const fetcher = vi.fn().mockResolvedValue(new Response(body));

		await expect(downloadBackupRequest('backup file.db', fetcher)).resolves.toEqual(body);
		expect(fetcher).toHaveBeenCalledWith(
			'/api/v1/admin/backups/download?filename=backup%20file.db'
		);
	});

	test('deletes a backup with the CSRF token and surfaces API errors', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(new Response(null, { status: 200 }))
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ message: 'Backup is locked' }), { status: 409 })
			);

		await expect(deleteBackupRequest('backup.db', 'csrf-token', fetcher)).resolves.toBeUndefined();
		expect(fetcher).toHaveBeenNthCalledWith(1, '/api/v1/admin/backups?filename=backup.db', {
			method: 'DELETE',
			headers: { 'X-CSRF-Token': 'csrf-token' }
		});
		await expect(deleteBackupRequest('backup.db', 'csrf-token', fetcher)).rejects.toThrow(
			'Backup is locked'
		);
	});

	test('uploads a restore file with the CSRF token', async () => {
		const file = new File(['backup'], 'backup.db');
		const fetcher = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify({ message: 'Restore queued' })));

		await expect(restoreBackupRequest(file, 'csrf-token', fetcher)).resolves.toEqual({
			message: 'Restore queued'
		});
		const options = fetcher.mock.calls[0]?.[1] as RequestInit;
		expect(options).toMatchObject({
			method: 'POST',
			headers: { 'X-CSRF-Token': 'csrf-token' }
		});
		expect(options.body).toBeInstanceOf(FormData);
		expect((options.body as FormData).get('file')).toBe(file);
	});
});
