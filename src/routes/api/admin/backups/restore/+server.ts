/**
 * Admin Backup Restore API
 * POST /api/admin/backups/restore — Restore database from an uploaded backup file
 */

import { json, error } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { restoreFromBuffer } from '$lib/server/backup';

export const _metadata = {
	POST: {
		summary: 'Restore database from backup',
		description:
			'Upload and restore the database from a backup file. Maximum file size is 500MB. The application should be restarted after a successful restore. Admin role required.',
		tags: ['Admin'],
		request: {
			body: {
				content: {
					'multipart/form-data': {
						schema: z.object({
							file: z
								.any()
								.openapi({ description: 'SQLite database backup file (.db)', format: 'binary' })
						})
					}
				}
			}
		},
		responses: {
			200: {
				description: 'Database restored successfully',
				content: {
					'application/json': {
						schema: z.object({
							success: z.boolean(),
							message: z.string(),
							backup: z.object({
								filename: z.string(),
								sizeBytes: z.number()
							})
						})
					}
				}
			},
			400: {
				description: 'No file uploaded or file too large (max 500MB)',
				content: { 'application/json': { schema: z.object({ message: z.string() }) } }
			},
			403: { description: 'Admin role required' }
		}
	}
};
import { logAudit } from '$lib/server/audit';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	try {
		const formData = await request.formData();
		const file = formData.get('file');

		if (!file || !(file instanceof File)) {
			throw error(400, 'No file uploaded');
		}

		// Limit file size to 500MB
		const MAX_SIZE = 500 * 1024 * 1024;
		if (file.size > MAX_SIZE) {
			throw error(400, 'File too large. Maximum size is 500MB.');
		}

		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		const result = await restoreFromBuffer(buffer);

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
		throw error(500, err instanceof Error ? err.message : 'Failed to restore backup');
	}
};
