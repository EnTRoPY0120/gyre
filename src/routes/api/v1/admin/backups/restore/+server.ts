/**
 * Admin Backup Restore API
 * POST /api/admin/backups/restore — Restore database from an uploaded backup file
 */

import { logger } from '$lib/server/logger.js';
import { json, error } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { restoreFromBuffer } from '$lib/server/backup';
import { logAudit } from '$lib/server/audit';
import { REQUEST_LIMITS, formatSize } from '$lib/server/request-limits';

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
								sizeBytes: z.number(),
								createdAt: z.string(),
								encrypted: z.boolean()
							})
						})
					}
				}
			},
			400: { description: 'No file uploaded' },
			403: { description: 'Admin role required' },
			413: {
				description: 'File too large (max 500MB)',
				content: { 'application/json': { schema: z.object({ message: z.string() }) } }
			}
		}
	}
};

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

		// Validate file size
		if (file.size > REQUEST_LIMITS.BACKUP_RESTORE) {
			throw error(
				413,
				`File too large. Maximum size is ${formatSize(REQUEST_LIMITS.BACKUP_RESTORE)}, received ${formatSize(file.size)}`
			);
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
		const status =
			err !== null && typeof err === 'object' && 'status' in err
				? (err as { status: unknown }).status
				: undefined;
		if (typeof status === 'number' && status >= 400 && status < 500) {
			throw err;
		}
		logger.error(err, 'Failed to restore backup:');
		throw error(500, 'Failed to restore backup');
	}
};
