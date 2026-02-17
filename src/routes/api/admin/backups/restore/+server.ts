/**
 * Admin Backup Restore API
 * POST /api/admin/backups/restore — Restore database from an uploaded backup file
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restoreFromBuffer } from '$lib/server/backup';
import { logAudit } from '$lib/server/audit';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, { message: 'Admin access required' });
	}

	try {
		const formData = await request.formData();
		const file = formData.get('file');

		if (!file || !(file instanceof File)) {
			throw error(400, { message: 'No file uploaded' });
		}

		// Limit file size to 500MB
		const MAX_SIZE = 500 * 1024 * 1024;
		if (file.size > MAX_SIZE) {
			throw error(400, { message: 'File too large. Maximum size is 500MB.' });
		}

		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		const result = restoreFromBuffer(buffer);

		await logAudit(locals.user, 'backup:restore', {
			resourceType: 'DatabaseBackup',
			resourceName: file.name,
			details: {
				uploadedSize: file.size,
				restoredSize: result.sizeBytes
			}
		});

		return json({
			success: true,
			message:
				'Database restored successfully. The application should be restarted for changes to take full effect.',
			backup: result
		});
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		console.error('Failed to restore backup:', err);
		const message = err instanceof Error ? err.message : 'Failed to restore backup';
		throw error(500, { message });
	}
};
